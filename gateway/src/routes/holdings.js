const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all holdings
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT h.*, a.name as account_name FROM holdings h JOIN accounts a ON h.account_id = a.id ORDER BY h.symbol ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching holdings:', error);
    res.status(500).json({ error: 'Database error fetching holdings' });
  }
});

// Create/Add a holding manually
router.post('/', async (req, res) => {
  const { account_id, symbol, asset_type, quantity, avg_buy_price, purchase_date } = req.body;

  if (!account_id || !symbol || !asset_type || quantity === undefined || avg_buy_price === undefined) {
    return res.status(400).json({ error: 'Missing required holdings fields.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO holdings (account_id, symbol, asset_type, quantity, avg_buy_price, purchase_date) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [account_id, symbol.toUpperCase().trim(), asset_type, quantity, avg_buy_price, purchase_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating holding:', error);
    res.status(500).json({ error: 'Database error adding holding.' });
  }
});

// Delete a holding
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM holdings WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Holding not found' });
    }
    res.json({ message: 'Holding deleted successfully', deletedHolding: result.rows[0] });
  } catch (error) {
    console.error('Error deleting holding:', error);
    res.status(500).json({ error: 'Database error deleting holding.' });
  }
});

module.exports = router;
