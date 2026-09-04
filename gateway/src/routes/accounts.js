const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all accounts
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM accounts ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Database error fetching accounts' });
  }
});

// Create a new account
router.post('/', async (req, res) => {
  const { name, type, current_balance, currency } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and Type are required' });
  }
  try {
    const result = await db.query(
      'INSERT INTO accounts (name, type, current_balance, currency) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, type, current_balance || 0.00, currency || 'INR']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Database error creating account' });
  }
});

// Update an account
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, current_balance, currency } = req.body;
  try {
    const result = await db.query(
      'UPDATE accounts SET name = COALESCE($1, name), type = COALESCE($2, type), current_balance = COALESCE($3, current_balance), currency = COALESCE($4, currency) WHERE id = $5 RETURNING *',
      [name, type, current_balance, currency, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Database error updating account' });
  }
});

// Delete an account
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM accounts WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json({ message: 'Account deleted successfully', deletedAccount: result.rows[0] });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Database error deleting account' });
  }
});

module.exports = router;
