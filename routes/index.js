const express = require('express');
const dotenv = require('dotenv');

dotenv.load();

const router = express.Router();

router.get('/', (req, res) => {
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line

  const responseData = {
    advertsStatus: db.advertsStatus,
    currentAdvert: db.adverts.find(ad => ad.name === db.currentAdvertName),
    advertsStatusToggled: !db.advertsStatus,
    adverts: db.adverts.reverse(),
    showAdverts: db.adverts.length > 0,
  };

  res.render('index', responseData);
});

module.exports = router;
