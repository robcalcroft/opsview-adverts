const express = require('express');
const dotenv = require('dotenv');
const moment = require('moment');

dotenv.load();

const router = express.Router();

router.get('/', (req, res) => {
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line

  res.render('index', {
    adverts_status: db.adverts_status,
    adverts_status_toggled: !db.adverts_status,
    adverts: db.adverts.reverse(),
    show_adverts: db.adverts.length > 0,
    helpers: {
      created: time => moment.unix(time).fromNow(),
    },
  });
});

module.exports = router;
