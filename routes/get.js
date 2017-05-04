const express = require('express');
const { log, db } = require('../helpers');

const router = express.Router();

router.get('/advert', (req, res) => {
  const { target_size: targetSize } = req.query;
  const searchTerms = [];
  let query = 'select * from adverts';

  if (targetSize) {
    searchTerms.push(targetSize);
    query += ' where target_size=? ';
  }

  db.all(query, searchTerms, (error, result) => {
    if (error) {
      const message = 'Error when retrieving records from database';
      log('error', message, error);
      res.status(500).json({
        success: false,
        message,
      });
    } else {
      res.json({
        success: true,
        result,
      });
    }
  });
});

router.get('/status', (req, res) => {
  db.all('select * from adverts', (error, result) => {
    if (error) {
      const message = 'Error when retrieving records from database';
      log('error', message, error);
      res.status(500).json({
        success: false,
        message,
      });
    } else {
      res.json({
        success: true,
        result,
      });
    }
  });
});

module.exports = router;
