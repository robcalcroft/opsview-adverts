const express = require('express');
const upload = require('multer')({ dest: 'tmp/' });
const path = require('path');
const fs = require('fs');
const { log, client } = require('../helpers');
const { versions: opsviewVersions } = require('../package.json').adverts;

const router = express.Router();
const bucket = 'opsview-adverts-testing';

// The route for when a user adds a new advert
router.post('/add', upload.single('advert_image'), (req, res) => {
  const {
    // advert_name: advertName,
    advert_redirect_url: advertRedirectUrl,
    advert_target_version: advertTargetVersionTmp,
    advert_target_size: advertTargetSize,
  } = req.body;
  const tmpPath = path.resolve('tmp');
  const { filename, mimetype } = req.file;

  // Ensure the advertTargetVersion variable is consistently an array
  const advertTargetVersion = Array.isArray(advertTargetVersionTmp) ? (
    advertTargetVersionTmp
  ) : Array(advertTargetVersionTmp);

  // Decide the list of target versions that will become folders on s3
  const versions = advertTargetVersion.includes('all') ? opsviewVersions : advertTargetVersion;
  const promises = [];

  // For each version create a sub folder with the ad image size in and add an advert.json file that
  // will contain information about how to display the advert
  versions.forEach((version) => {
    // Use an array of promises to only send a response to the client when all of them have
    // completed or when one has errored.
    const advertPath = `${version}/${advertTargetSize}`;

    promises.push(new Promise((resolve, reject) => {
      // Create the uploader object that will upload the advert file to s3
      const uploader = client.uploadFile({
        localFile: `${tmpPath}/${filename}`,
        s3Params: {
          ACL: 'public-read',
          Bucket: bucket,
          Key: `${advertPath}/${filename}.${mimetype.split('/')[1]}`,
        },
      });

      // Listen to when this upload is complete and resolve the promise
      uploader.on('end', () => {
        log('success', `Advert image for version ${version} and size ${advertTargetSize} uploaded`);

        // Attempt to delete the uploaded image file
        try {
          fs.unlinkSync(`${tmpPath}/${filename}`);
        } catch (error) {
          log('warning', 'Error removing temporary file, this should be cleaned up by the OS',
          error.stack);
        }
        resolve();
      });

      // Listen for errors and report a rejection
      uploader.on('error', (error) => {
        log('error', `Advert image for version ${version} and size ${advertTargetSize} errored during upload`, error.stack);
        reject(error);
      });
    }));

    promises.push(new Promise((resolve, reject) => {
      const tmpFileName = `${version}${advertTargetSize}.json`;

      // Write out the file temporarily so that the s3 SDK can upload it
      fs.writeFileSync(`${tmpPath}/${tmpFileName}`, JSON.stringify({
        enabled: true,
        image_url: `https://s3.amazonaws.com/${bucket}/${advertPath}/${filename}.${mimetype.split('/')[1]}`,
        redirect_url: advertRedirectUrl,
      }));

      // Create the uploader object that will upload the advert file to s3
      const uploader = client.uploadFile({
        localFile: `${tmpPath}/${tmpFileName}`,
        s3Params: {
          ACL: 'public-read',
          Bucket: bucket,
          Key: `${advertPath}/advert.json`,
        },
      });

      // Listen to when this upload is complete and resolve the promise
      uploader.on('end', () => {
        log('success', `Advert metadata file for version ${version} and size ${advertTargetSize} uploaded`);

        // Attempt to delete the temp file we created as cleanup
        try {
          fs.unlinkSync(`${tmpPath}/${tmpFileName}`);
        } catch (error) {
          log('warning', 'Error removing temporary file, this should be cleaned up by the OS',
          error.stack);
        }
        resolve();
      });

      // Listen for errors and report a rejection
      uploader.on('error', (error) => {
        log('error', `Advert metadata file for version ${version} and size ${advertTargetSize} errored during upload`, error.stack);
        reject(error);
      });
    }));
  });

  Promise.all(promises).then(() => {
    log('success', 'All advert metadata and imagery uploaded successfully to S3');

    res.json({
      success: true,
    });
  }).catch(() => {
    log('error', 'Uploads died due to error, this should be reported above');

    res.status(500).json({
      success: false,
      message: 'Check logs',
    });
  });
});

module.exports = router;
