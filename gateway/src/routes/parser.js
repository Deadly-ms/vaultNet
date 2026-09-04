const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

// Use memory storage for quick in-memory forwarding
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const quantEngineUrl = process.env.QUANT_ENGINE_URL || 'http://quant-engine:8000';

  try {
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    console.log(`Forwarding ${req.file.originalname} to Python parser at ${quantEngineUrl}/parse-document`);

    const response = await axios.post(`${quantEngineUrl}/parse-document`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error proxying document upload:', error.message);
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Quant engine parser error',
        details: error.response.data,
      });
    }
    res.status(500).json({ error: 'Failed to communicate with quant engine parser microservice.' });
  }
});

module.exports = router;
