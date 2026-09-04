const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Get transactions (with filters and pagination)
router.get('/', async (req, res) => {
  const { account_id, category, type, limit = 50, offset = 0 } = req.query;
  let queryText = 'SELECT t.*, a.name as account_name FROM transactions t JOIN accounts a ON t.account_id = a.id';
  const queryParams = [];
  const filters = [];

  if (account_id) {
    queryParams.push(account_id);
    filters.push(`t.account_id = $${queryParams.length}`);
  }
  if (category) {
    queryParams.push(category);
    filters.push(`t.category = $${queryParams.length}`);
  }
  if (type) {
    queryParams.push(type);
    filters.push(`t.type = $${queryParams.length}`);
  }

  if (filters.length > 0) {
    queryText += ' WHERE ' + filters.join(' AND ');
  }

  queryText += ' ORDER BY t.date DESC, t.id DESC LIMIT $' + (queryParams.length + 1) + ' OFFSET $' + (queryParams.length + 2);
  queryParams.push(parseInt(limit), parseInt(offset));

  try {
    const result = await db.query(queryText, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Database error fetching transactions' });
  }
});

// Create a single transaction (and adjust account balance)
router.post('/', async (req, res) => {
  const { account_id, date, amount, type, category, description, source, raw_text } = req.body;

  if (!account_id || !date || !amount || !type) {
    return res.status(400).json({ error: 'Account ID, Date, Amount, and Type are required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Insert transaction
    const transResult = await client.query(
      'INSERT INTO transactions (account_id, date, amount, type, category, description, source, raw_text) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [account_id, date, amount, type, category || 'Uncategorized', description, source || 'manual', raw_text]
    );

    // Adjust account balance
    const balanceAdjustment = type === 'credit' ? amount : -amount;
    await client.query(
      'UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2',
      [balanceAdjustment, account_id]
    );

    await client.query('COMMIT');
    res.status(201).json(transResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Database error creating transaction' });
  } finally {
    client.release();
  }
});

// Create bulk transactions (and adjust account balance)
router.post('/bulk', async (req, res) => {
  const { transactions } = req.body; // Array of transaction objects

  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: 'An array of transactions is required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const insertedTransactions = [];

    for (const tx of transactions) {
      const { account_id, date, amount, type, category, description, source, raw_text } = tx;
      if (!account_id || !date || !amount || !type) {
        throw new Error('Invalid transaction payload in bulk upload');
      }

      // Insert transaction
      const transResult = await client.query(
        'INSERT INTO transactions (account_id, date, amount, type, category, description, source, raw_text) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [account_id, date, amount, type, category || 'Uncategorized', description, source || 'pdf_upload', raw_text]
      );
      insertedTransactions.push(transResult.rows[0]);

      // Adjust account balance
      const balanceAdjustment = type === 'credit' ? amount : -amount;
      await client.query(
        'UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2',
        [balanceAdjustment, account_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(insertedTransactions);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in bulk transaction creation:', error);
    res.status(500).json({ error: 'Database error during bulk transaction upload: ' + error.message });
  } finally {
    client.release();
  }
});

// Delete a transaction (reverts account balance)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Retrieve the transaction first to get account_id, amount and type
    const txResult = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (txResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const tx = txResult.rows[0];

    // Revert the account balance adjustment
    // (If transaction was credit, subtract it from balance. If debit, add it back.)
    const balanceAdjustment = tx.type === 'credit' ? -tx.amount : tx.amount;
    await client.query(
      'UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2',
      [balanceAdjustment, tx.account_id]
    );

    // Delete transaction
    await client.query('DELETE FROM transactions WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ message: 'Transaction deleted successfully', deletedTransaction: tx });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Database error deleting transaction' });
  } finally {
    client.release();
  }
});

module.exports = router;
