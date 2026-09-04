const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../config/db');
require('dotenv').config();

const quantEngineUrl = process.env.QUANT_ENGINE_URL || 'http://quant-engine:8000';

// GET: Portfolio Risk Report (compiles active holdings and forwards)
router.get('/risk', async (req, res) => {
  try {
    const holdingsResult = await db.query('SELECT * FROM holdings');
    if (holdingsResult.rows.length === 0) {
      return res.json({
        volatility: 0.0,
        sharpe: 0.0,
        max_drawdown: 0.0,
        sectors: []
      });
    }

    const payload = holdingsResult.rows.map(h => ({
      symbol: h.symbol,
      type: h.asset_type,
      quantity: parseFloat(h.quantity),
      avg_price: parseFloat(h.avg_buy_price)
    }));

    console.log('Sending holdings series to python risk evaluator...');
    const response = await axios.post(`${quantEngineUrl}/quant/risk`, {
      holdings: payload,
      risk_free_rate: 0.06
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching quant risk report:', error.message);
    res.status(500).json({ error: 'Failed to compile quant portfolio risk parameters.' });
  }
});

// GET: Technical Indicators and Signal reports for Watchlist
router.get('/signals', async (req, res) => {
  try {
    const watchlistResult = await db.query('SELECT * FROM watchlist');
    if (watchlistResult.rows.length === 0) {
      return res.json([]);
    }

    const payload = watchlistResult.rows.map(w => ({
      symbol: w.symbol,
      asset_type: w.asset_type
    }));

    console.log('Fetching indicators signals from python quant engine...');
    const response = await axios.post(`${quantEngineUrl}/quant/signals`, {
      watchlist: payload
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching quant signals:', error.message);
    res.status(500).json({ error: 'Failed to resolve technical signals.' });
  }
});

// GET: Past Backtests History
router.get('/backtests/history', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM backtests ORDER BY created_at DESC LIMIT 30');
    res.json(result.rows);
  } catch (error) {
    console.error('Error loading backtests history:', error);
    res.status(500).json({ error: 'Database error loading backtests history.' });
  }
});

// POST: Run a Strategy Backtest (Dynamically seeds local database hypertable)
router.post('/backtest', async (req, res) => {
  const { symbol, strategy, params, start_date, end_date } = req.body;

  if (!symbol || !strategy || !start_date || !end_date) {
    return res.status(400).json({ error: 'Symbol, strategy, start_date, and end_date are required.' });
  }

  const cleanSymbol = symbol.toUpperCase().trim();
  const cleanStrategy = strategy.toLowerCase().trim();

  try {
    // 1. Check if we have price data cached in local price_history hypertable
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM price_history 
      WHERE symbol = $1 AND time >= $2 AND time <= $3
    `;
    const checkRes = await db.query(checkQuery, [cleanSymbol, start_date, end_date]);
    const dataCount = parseInt(checkRes.rows[0].count);

    console.log(`Checking price hypertable for ${cleanSymbol}: found ${dataCount} rows.`);

    // 2. Self-Healing sync: If we have insufficient local cache (less than 15 rows), download from yfinance
    if (dataCount < 15) {
      console.log(`Cache MISS for price series of ${cleanSymbol}. Seeding TimescaleDB hypertable dynamically...`);
      
      const downloadRes = await axios.get(`${quantEngineUrl}/quant/download`, {
        params: { symbol: cleanSymbol, start: start_date, end: end_date }
      });

      const downloadedPrices = downloadRes.data;

      // Insert downloaded rows in bulk
      const insertClient = await db.pool.connect();
      try {
        await insertClient.query('BEGIN');
        for (const row of downloadedPrices) {
          await insertClient.query(
            `INSERT INTO price_history (time, symbol, asset_type, open, high, low, close, volume)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT DO NOTHING`, // Since timescale doesn't enforce primary constraints, this works cleanly
            [row.time, cleanSymbol, 'stock', row.open, row.high, row.low, row.close, row.volume]
          );
        }
        await insertClient.query('COMMIT');
        console.log(`Seeded ${downloadedPrices.length} rows into price_history hypertable.`);
      } catch (insertError) {
        await insertClient.query('ROLLBACK');
        console.error('Failed executing hypertable database seed:', insertError);
      } finally {
        insertClient.release();
      }
    }

    // 3. Fetch full historical price series from DB hypertable
    const fetchQuery = `
      SELECT time, close 
      FROM price_history 
      WHERE symbol = $1 AND time >= $2 AND time <= $3 
      ORDER BY time ASC
    `;
    const priceSeriesRes = await db.query(fetchQuery, [cleanSymbol, start_date, end_date]);
    const pricesArray = priceSeriesRes.rows.map(row => ({
      time: row.time,
      close: parseFloat(row.close)
    }));

    if (pricesArray.length < 10) {
      return res.status(400).json({ 
        error: `Insufficient historical prices found for backtest range: ${pricesArray.length} entries.` 
      });
    }

    // 4. Request backtester calculations from Python
    console.log(`Running backtest for ${cleanSymbol} with ${cleanStrategy} strategy against ${pricesArray.length} prices...`);
    const backtestRes = await axios.post(`${quantEngineUrl}/quant/run-backtest`, {
      prices: pricesArray,
      strategy: cleanStrategy,
      params: params || {},
      risk_free_rate: 0.06
    });

    const results = backtestRes.data;

    // 5. Insert results into the relational backtests audit table
    const auditRes = await db.query(
      `INSERT INTO backtests (strategy_name, params_json, start_date, end_date, results_json)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [cleanStrategy, JSON.stringify(params || {}), start_date, end_date, JSON.stringify(results)]
    );

    res.json(auditRes.rows[0]);

  } catch (error) {
    console.error('Error running strategy backtest:', error.message);
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Quant engine strategy backtest execution error.',
        details: error.response.data
      });
    }
    res.status(500).json({ error: 'Gateway backtesting engine execution failed.' });
  }
});

// POST: Compare stocks/assets for SIP/Lumpsum performance & predictions
router.post('/compare', async (req, res) => {
  const { symbols, mode, frequency, amount, start_date, end_date, prediction_years } = req.body;

  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({ error: 'Symbols array is required and must not be empty.' });
  }

  try {
    console.log(`Routing stock comparison request for symbols: ${symbols.join(', ')} to quant engine...`);
    const response = await axios.post(`${quantEngineUrl}/quant/compare`, {
      symbols,
      mode: mode || 'sip',
      frequency: frequency || 'monthly',
      amount: parseFloat(amount) || 5000.0,
      start_date,
      end_date,
      prediction_years: parseInt(prediction_years) || 3
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error executing stock comparison in gateway:', error.message);
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Quant engine stock comparison failed.',
        details: error.response.data
      });
    }
    res.status(500).json({ error: 'API gateway comparison engine routing failed.' });
  }
});

module.exports = router;

