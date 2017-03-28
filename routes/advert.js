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
    currentAdvertMobile: db.adverts.find(ad => ad.name === db.currentAdvertMobile),
    currentAdvertDesktop1: db.adverts.find(ad => ad.name === db.currentAdvertDesktop1),
    currentAdvertDesktop2: db.adverts.find(ad => ad.name === db.currentAdvertDesktop2),
    advertsStatusToggled: !db.advertsStatus,
    adverts: db.adverts.reverse(),
    showAdverts: db.adverts.length > 0,
  };

  if (!advertToBeRemoved) {
    return res.render('index', Object.assign({}, responseData, {
      error: 'Unable remove advert, have you clicked Delete twice very quickly?',
    }));
  }

  if (db.currentAdvertMobile === advertToBeRemoved.name) {
    const mobileAdverts = db.adverts.filter(ad => ad.targetSize === '640x960');
    db.currentAdvertMobile = (mobileAdverts[0] && mobileAdverts[0].name) || '';
    responseData.currentAdvertMobile = db.adverts.find(ad => ad.name === db.currentAdvertMobile);
  }
  if (db.currentAdvertDesktop1 === advertToBeRemoved.name) {
    const desktop1Adverts = db.adverts.filter(ad => ad.targetSize === '500x300');
    db.currentAdvertDesktop1 = (desktop1Adverts[0] && desktop1Adverts[0].name) || '';
    responseData.currentAdvertDesktop1 = (
      db.adverts.find(ad => ad.name === db.currentAdvertDesktop1)
    );
  }
  if (db.currentAdvertDesktop2 === advertToBeRemoved.name) {
    const desktop2Adverts = db.adverts.filter(ad => ad.targetSize === '600x200');
    db.currentAdvertDesktop2 = (desktop2Adverts[0] && desktop2Adverts[0].name) || '';
    responseData.currentAdvertDesktop2 = (
      db.adverts.find(ad => ad.name === db.currentAdvertDesktop2)
    );
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
    targetSize: req.body.target_size,
    redirectUrl: req.body.redirect_url,
    created: ~~(new Date().getTime() / 1000), // eslint-disable-line no-bitwise
    s3Url: `https://s3.amazonaws.com/${process.env.BUCKET}/${imageFileName}`,
    imageSize: req.body.target_size,
    imageFileName,
  });

  if (req.body.target_size === '640x960' && db.currentAdvertMobile === '') {
    db.currentAdvertMobile = req.body.advert_name;
  }
  if (req.body.target_size === '500x300' && db.currentAdvertDesktop1 === '') {
    db.currentAdvertDesktop1 = req.body.advert_name;
  }
  if (req.body.target_size === '600x200' && db.currentAdvertDesktop2 === '') {
    db.currentAdvertDesktop2 = req.body.advert_name;
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
    currentAdvertMobile: db.adverts.find(ad => ad.name === db.currentAdvertMobile),
    currentAdvertDesktop1: db.adverts.find(ad => ad.name === db.currentAdvertDesktop1),
    currentAdvertDesktop2: db.adverts.find(ad => ad.name === db.currentAdvertDesktop2),
    advertsStatusToggled: !db.advertsStatus,
    adverts: db.adverts.reverse(),
    showAdverts: db.adverts.length > 0,
  };

  if (!req.body.advert_name) {
    return res.render('index', Object.assign({}, responseData, {
      error: 'No advert name specifed',
    }));
  }

  const advertToSet = db.adverts.find(ad => ad.name === req.body.advert_name);

  if (!advertToSet) {
    return res.render('index', Object.assign({}, responseData, {
      error: 'No advert found',
    }));
  }

  if (advertToSet.targetVersion === '640x960') {
    db.currentAdvertMobile = req.body.advert_name;
  }
  if (advertToSet.targetVersion === '500x300') {
    db.currentAdvertDesktop1 = req.body.advert_name;
  }
  if (advertToSet.targetVersion === '600x200') {
    db.currentAdvertDesktop2 = req.body.advert_name;
  }

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
