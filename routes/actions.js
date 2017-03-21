const express = require('express');
const fs = require('fs');
const moment = require('moment');
const multer = require('multer')({ dest: 'tmp/' });

const router = express.Router();

router.post('/action', multer.array(), (req, res) => {
  // Derive the adverts status
  const advertsStatus = req.body.toggle_adverts_status === 'true';
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line

  db.adverts_status = advertsStatus;

  // Update the database
  fs.writeFileSync(process.env.DATABASE_PATH, JSON.stringify(db));

  res.render('index', {
    adverts_status: db.adverts_status,
    adverts_status_toggled: !db.adverts_status,
    adverts: db.adverts.reverse(),
    show_adverts: db.adverts.length > 0,
    success: `Adverts ${advertsStatus ? 'enabled' : 'disabled'}`,
    helpers: {
      created: time => moment.unix(time).fromNow(),
    },
  });
});

module.exports = router;
