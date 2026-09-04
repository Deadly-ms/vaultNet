const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Initialize DB and Cache connections to verify they start cleanly
require('./config/db');
require('./config/redis');

// Import routes
const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const transactionsRoutes = require('./routes/transactions');
const budgetsRoutes = require('./routes/budgets');
const holdingsRoutes = require('./routes/holdings');
const watchlistRoutes = require('./routes/watchlist');
const statsRoutes = require('./routes/stats');
const parserRoutes = require('./routes/parser');
const marketRoutes = require('./routes/market');
const aiRoutes = require('./routes/ai');
const quantRoutes = require('./routes/quant');

// Import middleware
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend and other services
app.use(cors({
  origin: '*', // In development, allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'gateway', timestamp: new Date() });
});

// Authentication routes (unprotected)
app.use('/api/auth', authRoutes);

// Apply auth middleware to all secure API endpoints
app.use('/api/accounts', authMiddleware, accountsRoutes);
app.use('/api/transactions', authMiddleware, transactionsRoutes);
app.use('/api/budgets', authMiddleware, budgetsRoutes);
app.use('/api/holdings', authMiddleware, holdingsRoutes);
app.use('/api/watchlist', authMiddleware, watchlistRoutes);
app.use('/api/stats', authMiddleware, statsRoutes);
app.use('/api/parser', authMiddleware, parserRoutes);
app.use('/api/market', authMiddleware, marketRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/quant', authMiddleware, quantRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`API Gateway is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
});
