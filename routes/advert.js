const express = require('express');
const fs = require('fs');
const dotenv = require('dotenv');
const multer = require('multer')({ dest: 'tmp/' });

dotenv.load();

const helpers = require(`${process.env.PWD}/helpers.js`); // eslint-disable-line
const router = express.Router();

router.get('/advert', (req, res) => res.render('advert'));

const removeAdvert = (req, res) => {
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line

  // Remove the advert
  const advertToBeRemoved = db.adverts.find(advert => advert.name === req.body.advert_name);
  db.adverts = db.adverts.filter(advert => advert.name !== req.body.advert_name);

  const responseData = {
    advertsStatus: db.advertsStatus,
    currentAdvert: db.adverts.find(ad => ad.name === db.currentAdvertName),
    advertsStatusToggled: !db.advertsStatus,
    adverts: db.adverts.reverse(),
    showAdverts: db.adverts.length > 0,
  };

  if (!advertToBeRemoved) {
    return res.render('index', Object.assign({}, responseData, {
      error: 'Unable remove advert, have you clicked Delete twice very quickly?',
    }));
  }

  if (db.currentAdvertName === advertToBeRemoved.name) {
    db.currentAdvertName = (db.adverts[0] && db.adverts[0].name) || '';
    responseData.currentAdvert = db.adverts.find(ad => ad.name === db.currentAdvertName);
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
};

const addAdvert = (req, res) => {
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

  // CHECK IMAGE DIMENSIONS

  // Construct a unique file name for S3
  let imageFileName = new Buffer(`${req.file.originalname}-${new Date().getTime()}`).toString('base64');
  // Add the file extension from the mimetype
  imageFileName += `.${req.file.mimetype.split('/')[1]}`;
  const newImageFileLocation = `${process.env.PWD}/adverts/${imageFileName}`;

  // Move advert to adverts folder
  fs.renameSync(`${process.env.PWD}/${req.file.path}`, newImageFileLocation);

  // Add the new advert to the database
  db.adverts.push({
    name: req.body.advert_name,
    targetVersion: req.body.target_version,
    redirectUrl: req.body.redirect_url,
    created: ~~(new Date().getTime() / 1000), // eslint-disable-line no-bitwise
    s3Url: `https://s3.amazonaws.com/${process.env.BUCKET}/${imageFileName}`,
    imageSize: req.body.target_size,
    imageFileName,
  });

  if (db.currentAdvertName === '') {
    db.currentAdvertName = req.body.advert_name;
  }

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
};

const setActiveAdvert = (req, res) => {
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line

  const responseData = {
    advertsStatus: db.advertsStatus,
    currentAdvert: db.adverts.find(ad => ad.name === db.currentAdvertName),
    advertsStatusToggled: !db.advertsStatus,
    adverts: db.adverts.reverse(),
    showAdverts: db.adverts.length > 0,
  };

  if (!req.body.advert_name) {
    return res.render('index', Object.assign({}, responseData, {
      error: 'No advert name specifed',
    }));
  }

  db.currentAdvertName = req.body.advert_name;

  return helpers.writeAndUploadFile('adverts.json', process.env.DATABASE_PATH, JSON.stringify(db), (error) => {
    if (error) {
      return res.render('index', Object.assign({}, responseData, {
        error: `Unable to upload to S3: ${error.stack}`,
      }));
    }

    responseData.currentAdvert = db.adverts.find(ad => ad.name === db.currentAdvertName);

    return res.render('index', Object.assign({}, responseData, {
      success: `Current advert is now '${req.body.advert_name}'`,
    }));
  });
};

router.post('/advert', multer.single('advert_image'), (req, res) => {
  if (!req.body.cmd) {
    return res.render('advert', { error: 'No \'cmd\' parameter given' });
  }

  switch (req.body.cmd) {
    case 'add':
      return addAdvert(req, res);
    case 'remove':
      return removeAdvert(req, res);
    case 'change':
      return setActiveAdvert(req, res);
    default:
      return res.render('advert', { error: 'Incorrect \'cmd\' given' });
  }
});

module.exports = router;
