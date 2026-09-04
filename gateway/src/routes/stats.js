const express = require('express');
const router = express.Router();
const db = require('../config/db');
const redisClient = require('../config/redis');
const axios = require('axios');
require('dotenv').config();

// Helper to resolve live price of a symbol with Redis cache-aside caching
async function getLivePrice(symbol, type) {
  const cacheKey = `price:${symbol.toUpperCase().trim()}`;
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached).price || 0.0;
    }
    
    // Cache miss - query quant engine microservice
    const quantEngineUrl = process.env.QUANT_ENGINE_URL || 'http://quant-engine:8000';
    console.log(`Stats price fetcher cache MISS for ${symbol}. Querying quant-engine...`);
    
    const res = await axios.get(`${quantEngineUrl}/market/quote`, {
      params: { 
        symbol: symbol.toUpperCase().trim(), 
        type: type === 'mutual_fund' ? 'mutual_fund' : 'stock' 
      }
    });
    
    const price = res.data.price || 0.0;
    
    // Store in cache (expire in 15 mins)
    await redisClient.set(cacheKey, JSON.stringify(res.data), { EX: 900 });
    return price;
  } catch (error) {
    console.error(`Error resolving price for ${symbol} in stats engine:`, error.message);
    return 0.0;
  }
}

// Get overview stats (live combined net worth, category breakdowns, cash flow, 30-day net worth trend)
router.get('/overview', async (req, res) => {
  try {
    // 1. Fetch cash accounts balances
    const accountsResult = await db.query('SELECT * FROM accounts');
    const cashBalance = accountsResult.rows.reduce((sum, acc) => sum + parseFloat(acc.current_balance), 0);

    // 2. Fetch holdings and calculate live portfolio valuation
    const holdingsResult = await db.query('SELECT * FROM holdings');
    let holdingsValuation = 0.0;
    let portfolioCostBasis = 0.0;

    for (const holding of holdingsResult.rows) {
      const livePrice = await getLivePrice(holding.symbol, holding.asset_type);
      holdingsValuation += parseFloat(holding.quantity) * livePrice;
      portfolioCostBasis += parseFloat(holding.quantity) * parseFloat(holding.avg_buy_price);
    }

    // Live Combined Net Worth
    const netWorth = cashBalance + holdingsValuation;

    // 3. Spending by category for the current month (debit transactions)
    const categorySpendResult = await db.query(`
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE type = 'debit'
        AND date >= DATE_TRUNC('month', CURRENT_DATE)
        AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY category
      ORDER BY total DESC
    `);
    const categorySpend = categorySpendResult.rows.map(row => ({
      category: row.category,
      total: parseFloat(row.total)
    }));

    // 4. Current month total spend vs credit
    const monthlySumResult = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as monthly_debit,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as monthly_credit
      FROM transactions
      WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
        AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    `);
    const monthlyDebit = parseFloat(monthlySumResult.rows[0].monthly_debit);
    const monthlyCredit = parseFloat(monthlySumResult.rows[0].monthly_credit);

    // 5. Daily credit/debit transaction logs for cash flow charts (last 30 days)
    const dailyTrendResult = await db.query(`
      SELECT 
        TO_CHAR(date, 'YYYY-MM-DD') as date_str,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as credit,
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as debit
      FROM transactions
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date ASC
    `);
    const dailyTrend = dailyTrendResult.rows.map(row => ({
      date: row.date_str,
      credit: parseFloat(row.credit),
      debit: parseFloat(row.debit)
    }));

    // 6. Calculate Net Worth Trend over the last 30 days
    // We roll back cash transactions day by day, and add the current holdings valuation as a baseline.
    const allTxResult = await db.query(`
      SELECT date, amount, type 
      FROM transactions 
      WHERE date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY date DESC, id DESC
    `);
    
    const dailyNetWorthTrend = [];
    let rollingCash = cashBalance;

    // Create 30 days keys in reverse order (today backwards)
    for (let i = 0; i <= 30; i++) {
      const dateObj = new Date();
      dateObj.setDate(dateObj.getDate() - i);
      const dateStr = dateObj.toISOString().split('T')[0];

      // Add cash net worth + holdings live value
      dailyNetWorthTrend.unshift({
        date: dateStr,
        netWorth: parseFloat((rollingCash + holdingsValuation).toFixed(2)),
        cash: parseFloat(rollingCash.toFixed(2)),
        assets: parseFloat(holdingsValuation.toFixed(2))
      });

      // Roll back cash: subtract credits, add debits that happened on this day
      const daysTxs = allTxResult.rows.filter(tx => {
        const txDateStr = new Date(tx.date).toISOString().split('T')[0];
        return txDateStr === dateStr;
      });

      for (const tx of daysTxs) {
        if (tx.type === 'credit') {
          rollingCash -= parseFloat(tx.amount);
        } else if (tx.type === 'debit') {
          rollingCash += parseFloat(tx.amount);
        }
      }
    }

    res.json({
      netWorth,
      cashBalance,
      holdingsValuation,
      portfolioCostBasis,
      categorySpend,
      monthlyDebit,
      monthlyCredit,
      dailyTrend,
      netWorthTrend: dailyNetWorthTrend
    });
  } catch (error) {
    console.error('Error fetching stats overview:', error);
    res.status(500).json({ error: 'Database error fetching dashboard metrics.' });
  }
});

module.exports = router;
