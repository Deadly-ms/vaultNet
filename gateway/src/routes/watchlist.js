const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all watchlist items
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM watchlist ORDER BY symbol ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching watchlist:', error);
    res.status(500).json({ error: 'Database error fetching watchlist' });
  }
});

// Add ticker to watchlist
router.post('/', async (req, res) => {
  const { symbol, asset_type } = req.body;

  if (!symbol || !asset_type) {
    return res.status(400).json({ error: 'Symbol and Asset Type are required.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO watchlist (symbol, asset_type) 
       VALUES ($1, $2) 
       ON CONFLICT (symbol) 
       DO UPDATE SET asset_type = EXCLUDED.asset_type, added_at = NOW() 
       RETURNING *`,
      [symbol.toUpperCase().trim(), asset_type]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ error: 'Database error adding to watchlist.' });
  }
});

// Remove from watchlist
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM watchlist WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }
    res.json({ message: 'Watchlist item removed successfully', deletedWatchlist: result.rows[0] });
  } catch (error) {
    console.error('Error deleting from watchlist:', error);
    res.status(500).json({ error: 'Database error deleting from watchlist.' });
  }
});

module.exports = router;
