const express = require('express');
const bodyParser = require('body-parser');
const request = require('request-promise-native');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { client, log, db } = require('../helpers');
const { amazon_bucket: bucket } = require('../.env.json');

const router = express.Router();
const sizes = ['640x960', '500x300', '600x200'];
const tmpPath = path.resolve('tmp');

router.post('/status', bodyParser.urlencoded({ extended: true }), (req, res) => {
  const enabled = req.body.enabled === '1';
  log('info', `${enabled ? 'Enabling' : 'Disabling'} adverts`);

  const advertResponses = sizes.map(size => new Promise((resolve) => {
    request(`https://s3.amazonaws.com/${bucket}/${size}/advert.json`)
    .then(data => resolve({
      size,
      data,
    }))
    .catch(() => resolve(false));
  }));

  Promise.all(advertResponses).then((responses) => {
    const successfulResponses = responses.filter(response => response !== false);

    const uploaders = successfulResponses.map(response => new Promise((resolve, reject) => {
      const tmpFileName = crypto.randomBytes(32).toString('hex');
      const tmpFilePath = `${tmpPath}/${tmpFileName}`;
      const parsedResponse = JSON.parse(response.data);

      parsedResponse.enabled = enabled;

      fs.writeFileSync(tmpFilePath, JSON.stringify(parsedResponse));

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
      db.run('update status set enabled=? where status_name=?', [enabled, 'adverts'], (error) => {
        if (error) {
          log('error', 'Error updating status in database', error.message);
          res.status(500).json({
            success: false,
            message: `Error updating status in database ${error.message}`,
          });
        } else {
          log('success', `Adverts ${enabled ? 'Enabled' : 'Disabled'}`);
          res.json({
            success: true,
          });
        }
      });
    }).catch((error) => {
      log('error', `Error when ${enabled ? 'enabling' : 'disabling'} adverts`, error.message);
      res.status(500).json({
        success: false,
      });
    });
  });
});

router.get('/status', (req, res) => {
  db.get('select enabled from status where status_name=?', ['adverts'], (error, result) => {
    if (error) {
      const message = 'Error when retrieving records from database';
      log('error', message, error);
      res.json({
        success: true,
        message,
      });
    } else {
      res.json({
        success: true,
        result,
      });
    }
  });
});

module.exports = router;
