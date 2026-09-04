const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
require('dotenv').config();

router.post('/login', (req, res) => {
  const { pin } = req.body;
  const masterPin = process.env.MASTER_PIN || '1234';

  if (pin && pin.toString() === masterPin.toString()) {
    const token = jwt.sign(
      { authorized: true },
      process.env.JWT_SECRET || 'supersecretfintechkey123!',
      { expiresIn: '7d' }
    );
    return res.json({ success: true, token });
  }

  return res.status(401).json({ success: false, error: 'Invalid PIN' });
});

router.get('/verify', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.json({ valid: false });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'supersecretfintechkey123!');
    return res.json({ valid: true });
  } catch (error) {
    return res.json({ valid: false });
  }
});

module.exports = router;
