const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../config/db');
const redisClient = require('../config/redis');
require('dotenv').config();

// Helper to compile DB records into a unified portfolio context object
async function compilePortfolioContext() {
  const [accountsRes, holdingsRes, budgetsRes, monthlySumRes, categorySpendRes] = await Promise.all([
    db.query('SELECT id, name, type, current_balance FROM accounts'),
    db.query('SELECT h.*, a.name as account_name FROM holdings h JOIN accounts a ON h.account_id = a.id'),
    db.query('SELECT * FROM budgets'),
    db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as monthly_debit,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as monthly_credit
      FROM transactions
      WHERE date >= DATE_TRUNC('month', CURRENT_DATE)
        AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    `),
    db.query(`
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE type = 'debit'
        AND date >= DATE_TRUNC('month', CURRENT_DATE)
        AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
      GROUP BY category
    `)
  ]);

  const cashBalance = accountsRes.rows.reduce((sum, acc) => sum + parseFloat(acc.current_balance), 0);
  const monthlyDebit = parseFloat(monthlySumRes.rows[0].monthly_debit);
  const monthlyCredit = parseFloat(monthlySumRes.rows[0].monthly_credit);

  const categorySpend = categorySpendRes.rows.map(row => ({
    category: row.category,
    total: parseFloat(row.total)
  }));

  // Resolve approximate holdings cost basis
  const portfolioCostBasis = holdingsRes.rows.reduce((sum, h) => sum + (parseFloat(h.quantity) * parseFloat(h.avg_buy_price)), 0);

  // We construct a simple holdings list for Gemini context
  const holdings = holdingsRes.rows.map(h => ({
    symbol: h.symbol,
    type: h.asset_type,
    quantity: parseFloat(h.quantity),
    avg_price: parseFloat(h.avg_buy_price),
    broker: h.account_name
  }));

  // Return context (frontend stats will resolve live valuation, but here we provide cost bases)
  return {
    netWorth: cashBalance + portfolioCostBasis, // Cost basis approximation for static context
    cashBalance,
    holdingsValuation: portfolioCostBasis,
    portfolioCostBasis,
    monthlyDebit,
    monthlyCredit,
    categorySpend,
    budgets: budgetsRes.rows,
    holdings
  };
}

// POST: Chat with AI coach
router.post('/chat', async (req, res) => {
  const { prompt, history, role } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  const quantEngineUrl = process.env.QUANT_ENGINE_URL || 'http://quant-engine:8000';

  try {
    const portfolioContext = await compilePortfolioContext();
    console.log(`Sending chat query with portfolio context to AI Coach (Role: ${role || 'coach'})...`);

    const response = await axios.post(`${quantEngineUrl}/ai/query`, {
      prompt,
      portfolio_context: portfolioContext,
      history: history || [],
      role: role || 'coach'
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error communicating with AI Chat Coach:', error.message);
    res.status(500).json({ error: 'AI Coach microservice communication error.' });
  }
});

// GET: Portfolio Insights (with 24h caching)
router.get('/insights', async (req, res) => {
  const { refresh } = req.query;
  const cacheKey = 'ai:insights';
  const quantEngineUrl = process.env.QUANT_ENGINE_URL || 'http://quant-engine:8000';

  try {
    // 1. Check Cache unless forced refresh
    if (refresh !== 'true') {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log('Cache HIT for portfolio insights');
        return res.json(JSON.parse(cached));
      }
    }

    // 2. Cache Miss - compile context & query AI
    console.log('Cache MISS for insights. Generating fresh AI Insights...');
    const portfolioContext = await compilePortfolioContext();
    
    const response = await axios.post(`${quantEngineUrl}/ai/portfolio-insights`, {
      portfolio_context: portfolioContext
    });

    const insightsData = response.data;

    // Cache for 24 hours (86400 seconds)
    await redisClient.set(cacheKey, JSON.stringify(insightsData), {
      EX: 86400
    });

    res.json(insightsData);
  } catch (error) {
    console.error('Error generating AI Insights:', error.message);
    res.status(500).json({ error: 'Failed to generate AI insights.' });
  }
});

// GET: Stock/MF News summary (with 6h caching)
router.get('/news', async (req, res) => {
  const { symbol, name, type } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol parameter is required.' });
  }

  const cacheKey = `ai:news:${symbol.toUpperCase().trim()}`;
  const quantEngineUrl = process.env.QUANT_ENGINE_URL || 'http://quant-engine:8000';

  try {
    // Check Cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`Cache HIT for news summary of ${symbol}`);
      return res.json(JSON.parse(cached));
    }

    // Cache Miss - Query Flask summaries
    console.log(`Cache MISS for news summary of ${symbol}. Summarizing RSS feed...`);
    const response = await axios.get(`${quantEngineUrl}/ai/news-summary`, {
      params: { 
        symbol: symbol.trim(), 
        name: name ? name.trim() : '', 
        type: type || 'stock' 
      }
    });

    const newsData = response.data;

    // Cache for 6 hours (21600 seconds)
    await redisClient.set(cacheKey, JSON.stringify(newsData), {
      EX: 21600
    });

    res.json(newsData);
  } catch (error) {
    console.error(`Error loading news summary for ${symbol}:`, error.message);
    res.status(500).json({ error: 'Failed to summarize news feed.' });
  }
});

module.exports = router;
