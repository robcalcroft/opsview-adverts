const express = require('express');
const bodyParser = require('body-parser');
const request = require('request-promise-native');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { client, log, db, downloadImageAndUploadLegacyAdvert } = require('../helpers');
const { amazon_bucket: bucket } = require('../.env.json');

const router = express.Router();
const sizes = ['640x960', '500x300', '600x200'];
const tmpPath = path.resolve('tmp');

router.post('/status', bodyParser.urlencoded({ extended: true }), (req, res) => {
  const enabled = req.body.enabled === '1';
  log('info', `${enabled ? 'Enabling' : 'Disabling'} adverts`);

  if (!enabled) {
    // Disabling
    const filesToDelete = [
      'opsview-ad-login.png',
      'opsview-ad-login.html',
      'opsview-ad-login-redirect.html',
      'opsview-ad-phone.png',
      'opsview-ad-phone.html',
      'opsview-ad-phone-redirect.html',
      'opsview-ad-reload.png',
      'opsview-ad-reload.html',
      'opsview-ad-reload-redirect.html',
    ];

    const deleter = client.deleteObjects({
      Bucket: bucket,
      Delete: {
        Objects: filesToDelete.map(file => ({ Key: file })),
      },
    });

    deleter.on('end', () => log('success', 'All legacy advert files deleted (this is the "disabled" state)'));

    deleter.on('error', error => log('error', 'Error deleting legacy advert from S3', error.message));
  }

  db.all('select * from adverts', (dbError, adverts) => {
    if (adverts && adverts.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No adverts to enable, add an advert to enable adverts',
      });
    }

    const advertResponses = sizes.map(size => new Promise((resolve) => {
      request(`https://s3.amazonaws.com/${bucket}/${size}/advert.json`)
      .then(data => resolve({
        size,
        data,
      }))
      .catch(() => resolve(false));
    }));

    return Promise.all(advertResponses).then((responses) => {
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

      // Reupload all of our legacy adverts
      if (enabled) {
        uploaders.push(new Promise((resolve) => {
          if (successfulResponses.length === 0) {
            log('warning', 'No successful responses');
            return resolve();
          }
          const legacyUploaders = successfulResponses.map(response => new Promise((
            resoveLegacyUploader
          ) => {
            const advertData = JSON.parse(response.data);
            downloadImageAndUploadLegacyAdvert(advertData, tmpPath, resoveLegacyUploader);
          }));
          return Promise.all(legacyUploaders).then(resolve).catch(error => log('error', error.message) && resolve());
        }));
      }

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
