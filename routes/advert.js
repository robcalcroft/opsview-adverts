const express = require('express');
const fs = require('fs');
const dotenv = require('dotenv');
const multer = require('multer')({ dest: 'tmp/' });

dotenv.load();

const helpers = require(`${process.env.PWD}/helpers.js`); // eslint-disable-line
const router = express.Router();

router.get('/advert', (req, res) => res.render('advert'));

router.post('/advert', multer.single('advert_image'), (req, res) => {
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line
  const oneMb = 1000000;

  // Check the uploaded image is less than 2mb
  if (req.file.size > (oneMb * 2)) {
    return res.render('advert', {
      error: `Uploaded file was ${(req.file.size / oneMb).toFixed(1)}mb; it must be less than 2mb`,
    });
  }

  // Check the uploaded image is a PNG or JPEG
  if (req.file.mimetype !== 'image/png' && req.file.mimetype !== 'image/jpeg') {
    return res.render('advert', {
      error: 'Uploaded file must be a PNG or a JPEG',
    });
  }

  // Construct a unique file name for S3
  let imageFileName = new Buffer(`${req.file.originalname}-${new Date().getTime()}`).toString('base64');
  // Add the file extension from the mimetype
  imageFileName += `.${req.file.mimetype.split('/')[1]}`;
  const newImageFileLocation = `${process.env.PWD}/adverts/${imageFileName}`;

  // Move advert to adverts folder
  fs.renameSync(`${process.env.PWD}/${req.file.path}`, newImageFileLocation);

  // Add the new advert to the database
  db.adverts.push({
    advertName: req.body.advert_name,
    targetVersion: req.body.target_version,
    redirectUrl: req.body.redirect_url,
    created: ~~(new Date().getTime() / 1000), // eslint-disable-line no-bitwise
    s3Url: `https://s3.amazonaws.com/${process.env.BUCKET}/${imageFileName}`,
    imageFileName,
  });

  return helpers.writeAndUploadFile('adverts.json', process.env.DATABASE_PATH, JSON.stringify(db), (databaseUploadError) => {
    if (databaseUploadError) {
      return res.render('advert', { error: `Unable to upload ${process.env.DATABASE_PATH}: ${databaseUploadError.stack}` });
    }
    return helpers.writeAndUploadFile(
      imageFileName,
      newImageFileLocation,
      false,
      (imageUploadError) => {
        if (imageUploadError) {
          return res.render('advert', { error: `Unable to upload ${newImageFileLocation}: ${imageUploadError.stack}` });
        }

        return res.render('advert', { success: `New advert ${req.body.advert_name} added to S3` });
      } // eslint-disable-line comma-dangle
    );
  });
});

// This should be a DELETE but you can't use DELETE in a HTML form :(
router.post('/remove-advert', multer.array(), (req, res) => {
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line

  // Remove the advert
  const advertToBeRemoved = db.adverts.find(advert => advert.advertName === req.body.advert_name);
  db.adverts = db.adverts.filter(advert => advert.advertName !== req.body.advert_name);

  const responseData = {
    adverts_status: db.adverts_status,
    adverts_status_toggled: !db.adverts_status,
    adverts: db.adverts.reverse(),
    show_adverts: db.adverts.length > 0,
  };

  if (!advertToBeRemoved) {
    return res.render('index', Object.assign({}, responseData, {
      error: 'Unable remove advert, have you clicked Delete twice very quickly?',
    }));
  }

  return helpers.writeAndUploadFile('adverts.json', process.env.DATABASE_PATH, JSON.stringify(db), (error) => {
    if (error) {
      return res.render('index', Object.assign({}, responseData, {
        error: `Unable to upload ${process.env.DATABASE_PATH}: ${error.stack}`,
      }));
    }

    return helpers.deleteFiles([advertToBeRemoved.imageFileName], (deleteFilesError) => {
      if (deleteFilesError) {
        return res.render('index', Object.assign({}, responseData, {
          error: `Unable to delete ${req.body.advert_name} from S3: ${deleteFilesError.stack}`,
        }));
      }

      return res.render('index', Object.assign({}, responseData, {
        success: `${req.body.advert_name} removed`,
      }));
    });
  });
});

module.exports = router;
