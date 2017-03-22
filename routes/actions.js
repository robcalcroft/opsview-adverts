const express = require('express');
const dotenv = require('dotenv');
const multer = require('multer')({ dest: 'tmp/' });

dotenv.load();

const writeAndUploadFile = require(`${process.env.PWD}/helpers.js`).writeAndUploadFile; // eslint-disable-line
const router = express.Router();

router.post('/action', multer.array(), (req, res) => {
  // Derive the adverts status
  const advertsStatus = req.body.toggle_adverts_status === 'true';
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line

  db.adverts_status = advertsStatus;

  const responseData = {
    adverts_status: db.adverts_status,
    adverts_status_toggled: !db.adverts_status,
    adverts: db.adverts.reverse(),
    show_adverts: db.adverts.length > 0,
  };

  writeAndUploadFile('adverts.json', process.env.DATABASE_PATH, JSON.stringify(db), (error) => {
    if (error) {
      return res.render('index', Object.assign({}, responseData, {
        error: `Unable to upload ${process.env.DATABASE_PATH}: ${error.stack}`,
      }));
    }

    return res.render('index', Object.assign({}, responseData, {
      success: `Adverts ${advertsStatus ? 'enabled' : 'disabled'}`,
    }));
  });
});

module.exports = router;
