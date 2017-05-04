const express = require('express');
const upload = require('multer')({ dest: 'tmp/' });
const path = require('path');
const fs = require('fs');
const { log, client, db } = require('../helpers');

const router = express.Router();
const bucket = 'opsview-adverts-testing';

// The route for when a user adds a new advert
router.post('/advert/new', upload.single('advert_image'), (req, res) => {
  const {
    advert_name: advertName,
    advert_redirect_url: advertRedirectUrl,
    advert_target_size: advertTargetSize,
  } = req.body;
  const tmpPath = path.resolve('tmp');
  const { filename, mimetype } = req.file;
  const computedImageFileName = `${filename}.${mimetype.split('/')[1]}`;
  const computedS3ImageLocation = `${advertTargetSize}/${computedImageFileName}`;

  const imageUpload = new Promise((resolve, reject) => {
    // Create the uploader object that will upload the advert file to s3
    const uploader = client.uploadFile({
      localFile: `${tmpPath}/${filename}`,
      s3Params: {
        ACL: 'public-read',
        Bucket: bucket,
        Key: computedS3ImageLocation,
      },
    });

    // Listen to when this upload is complete and resolve the promise
    uploader.on('end', () => {
      log('success', `Advert image for size ${advertTargetSize} uploaded`);

      // Attempt to delete the uploaded image file
      try {
        fs.unlinkSync(`${tmpPath}/${filename}`);
      } catch (error) {
        log('warning', 'Error removing temporary file, this should be cleaned up by the OS');
      }

      resolve();
    });

    // Listen for errors and report a rejection
    uploader.on('error', (error) => {
      log('error', `Advert image for size ${advertTargetSize} errored during upload`, error.message);
      reject(error);
    });
  });

  // Conditonally run this step based on if we set uploaded as current
  const metaDataUpload = new Promise((resolve, reject) => {
    const tmpFileName = `${advertTargetSize}.json`;

    // Write out the file temporarily so that the s3 SDK can upload it
    fs.writeFileSync(`${tmpPath}/${tmpFileName}`, JSON.stringify({
      enabled: true,
      image_url: `https://s3.amazonaws.com/${bucket}/${computedS3ImageLocation}`,
      redirect_url: advertRedirectUrl,
    }));

    // Create the uploader object that will upload the advert file to s3
    const uploader = client.uploadFile({
      localFile: `${tmpPath}/${tmpFileName}`,
      s3Params: {
        ACL: 'public-read',
        Bucket: bucket,
        Key: `${advertTargetSize}/advert.json`,
      },
    });

    // Listen to when this upload is complete and resolve the promise
    uploader.on('end', () => {
      log('success', `Advert metadata file for size ${advertTargetSize} uploaded`);

      // Attempt to delete the temp file we created as cleanup
      try {
        fs.unlinkSync(`${tmpPath}/${tmpFileName}`);
      } catch (error) {
        log('warning', 'Error removing temporary file, this should be cleaned up by the OS');
      }
      resolve();
    });

    // Listen for errors and report a rejection
    uploader.on('error', (error) => {
      log('error', `Advert metadata file for size ${advertTargetSize} errored during upload`, error.message);
      reject(error);
    });
  });

  // When the metadata and image have been uploaded this runs or when one of them fails
  Promise.all([imageUpload, metaDataUpload]).then(() => {
    log('success', 'All advert metadata and imagery uploaded successfully to S3');

    db.all('insert into adverts (name, target_size, redirect_url, image_name) values (?, ?, ?, ?)', [
      advertName,
      advertTargetSize,
      advertRedirectUrl,
      computedImageFileName,
    ], (error) => {
      if (error) {
        log('error', 'Could not update database with new advert', error.message);

        res.status(500).json({
          success: false,
          message: 'Could not update database, see logs',
        });
      } else {
        log('success', 'Advert data successfully loaded into database');

        res.json({
          success: true,
        });
      }
    });
  }).catch((error) => {
    log('error', 'Uploads or database error died, this should be reported above or below\n', error.stack);

    res.status(500).json({
      success: false,
      message: 'Check logs',
    });
  });
});

module.exports = router;
