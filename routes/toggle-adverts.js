const express = require('express');
const bodyParser = require('body-parser');
const request = require('request-promise-native');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { client, log } = require('../helpers');

const router = express.Router();
const sizes = ['640x960', '500x300', '600x200'];
const bucket = 'opsview-adverts-testing';
const tmpPath = path.resolve('tmp');

router.post('/status', bodyParser.urlencoded({ extended: true }), (req, res) => {
  const advertResponses = sizes.map(size => new Promise((resolve) => {
    request(`https://s3.amazonaws.com/${bucket}/${size}/advert.json`)
    .then((data) => {
      resolve({
        size,
        data,
      });
    })
    .catch(() => resolve(false));
  }));

  Promise.all(advertResponses).then((responses) => {
    const successfulResponses = responses.filter(response => response !== false);

    const uploaders = successfulResponses.map(response => new Promise((resolve, reject) => {
      const tmpFileName = crypto.randomBytes(32).toString('hex');
      const tmpFilePath = `${tmpPath}/${tmpFileName}`;
      //Log everytjing dunno why its looks weird!
      fs.writeFileSync(tmpFilePath, JSON.stringify(Object.assign({}, response.data, {
        enabled: false,
      })));

      const uploader = client.uploadFile({
        localFile: tmpFilePath,
        s3Params: {
          ACL: 'public-read',
          Bucket: bucket,
          Key: `${response.size}/advert.json`,
        },
      });

      // Listen to when this upload is complete and resolve the promise
      uploader.on('end', () => {
        log('success', `Advert metadata file for size ${response.size} uploaded`);
        resolve();
      });

      // Listen for errors and report a rejection
      uploader.on('error', (error) => {
        log('error', `Advert metadata file for size ${response.size} errored during upload`, error.message);
        reject(error);
      });
    }));

    Promise.all(uploaders).then(() => {
      log('success', 'Adverts disabled');
      res.json({
        success: true,
      });
    }).catch((error) => {
      log('error', 'Error when disabling adverts', error.message);
      res.status(500).json({
        success: false,
      });
    });
  });
});

module.exports = router;
