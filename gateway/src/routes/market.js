const express = require('express');
const router = express.Router();
const axios = require('axios');
const redisClient = require('../config/redis');
require('dotenv').config();

// Get live quote with cache-aside pattern using Redis
router.get('/price', async (req, res) => {
  const { symbol, type } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol parameter is required.' });
  }

  const assetType = (type || 'stock').toLowerCase();
  const cacheKey = `price:${symbol.toUpperCase().trim()}`;
  const quantEngineUrl = process.env.QUANT_ENGINE_URL || 'http://quant-engine:8000';

  try {
    // 1. Check Cache
    let cachedData = null;
    try {
      cachedData = await redisClient.get(cacheKey);
    } catch (cacheError) {
      console.warn('Redis read error (bypassing to live lookup):', cacheError.message);
    }

    if (cachedData) {
      // Cache hit!
      console.log(`Cache HIT for ${symbol}`);
      return res.json(JSON.parse(cachedData));
    }

    // 2. Cache Miss - Query Python Microservice
    console.log(`Cache MISS for ${symbol}. Fetching live quote from Python quant-engine...`);
    const response = await axios.get(`${quantEngineUrl}/market/quote`, {
      params: { symbol: symbol.trim(), type: assetType }
    });

    const quoteData = response.data;

    // 3. Write back to cache (Expire in 15 minutes = 900 seconds)
    try {
      await redisClient.set(cacheKey, JSON.stringify(quoteData), {
        EX: 900
      });
      console.log(`Cache WRITE for ${symbol} success.`);
    } catch (cacheWriteError) {
      console.warn('Redis write error:', cacheWriteError.message);
    }

    return res.json(quoteData);

  } catch (error) {
    console.error(`Error loading market quote for ${symbol}:`, error.message);
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Failed to load live price from quote server.',
        details: error.response.data
      });
    }
    return res.status(500).json({ error: 'Market quote gateway service error.' });
  }
});

module.exports = router;
