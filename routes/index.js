const express = require('express');
const dotenv = require('dotenv');

dotenv.load();

const router = express.Router();

router.get('/', (req, res) => {
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line

  const responseData = {
    adverts_status: db.adverts_status,
    adverts_status_toggled: !db.adverts_status,
    adverts: db.adverts.reverse(),
    show_adverts: db.adverts.length > 0,
  };

  res.render('index', responseData);
});

module.exports = router;
