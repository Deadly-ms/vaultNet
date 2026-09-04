const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get all budgets
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM budgets ORDER BY category ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: 'Database error fetching budgets' });
  }
});

// Get budget vs actual spending summary for the current month
router.get('/summary', async (req, res) => {
  const queryText = `
    SELECT 
      b.id,
      b.category,
      b.monthly_limit,
      COALESCE(SUM(CASE WHEN t.type = 'debit' THEN t.amount ELSE 0 END), 0) AS current_spend
    FROM budgets b
    LEFT JOIN transactions t ON 
      LOWER(t.category) = LOWER(b.category) 
      AND t.date >= DATE_TRUNC('month', CURRENT_DATE)
      AND t.date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    GROUP BY b.id, b.category, b.monthly_limit
    ORDER BY b.category ASC
  `;

  try {
    const result = await db.query(queryText);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching budget summary:', error);
    res.status(500).json({ error: 'Database error calculating budget summary' });
  }
});

// Create or update a budget (upsert on category)
router.post('/', async (req, res) => {
  const { category, monthly_limit } = req.body;
  if (!category || monthly_limit === undefined) {
    return res.status(400).json({ error: 'Category and monthly_limit are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO budgets (category, monthly_limit) 
       VALUES ($1, $2) 
       ON CONFLICT (category) 
       DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit, created_at = NOW() 
       RETURNING *`,
      [category, monthly_limit]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error upserting budget:', error);
    res.status(500).json({ error: 'Database error creating or updating budget' });
  }
});

// Delete a budget
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM budgets WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    res.json({ message: 'Budget deleted successfully', deletedBudget: result.rows[0] });
  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({ error: 'Database error deleting budget' });
  }
});

module.exports = router;
