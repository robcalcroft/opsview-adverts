const express = require('express');
const upload = require('multer')({ dest: 'tmp/' });
const path = require('path');
const request = require('request-promise-native');
const fs = require('fs');
const { log, client, db, targetSizeLegacyMap, uploadLegacyAdvert } = require('../helpers');
const { amazon_bucket: bucket } = require('../.env.json');

const router = express.Router();

// The route for when a user adds a new advert
router.post('/advert/new', upload.single('advert_image'), (req, res) => {
  const {
    advert_name: advertName,
    advert_redirect_url: advertRedirectUrl,
    advert_target_size: advertTargetSize,
    advert_override: advertOverride,
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

  // If we are not overriding the current advert then we dont need to modify the advert.json file
  // for that advert so we can just upload the image and add it to the database
  const promisesToWaitFor = [imageUpload];
  if (advertOverride !== undefined) {
    log('info', 'Updating advert file on S3');
    promisesToWaitFor.push(new Promise((resolve, reject) => {
      const tmpFileName = `${advertTargetSize}.json`;

      db.all('select enabled from status where status_name=?', ['adverts'], (dbError, result) => {
        if (dbError) {
          return reject(dbError);
        }

        // Write out the file temporarily so that the s3 SDK can upload it
        fs.writeFileSync(`${tmpPath}/${tmpFileName}`, JSON.stringify({
          enabled: !!result[0].enabled,
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
        return uploader.on('error', (error) => {
          log('error', `Advert metadata file for size ${advertTargetSize} errored during upload`, error.message);
          reject(error);
        });
      });
    }));

    log('info', 'Uploading legacy advert');
    promisesToWaitFor.push(new Promise((resolve) => {
      request(`https://s3.amazonaws.com/${bucket}/opsview-ad-${targetSizeLegacyMap[advertTargetSize]}.png`)
      .then(() => {
        log('info', 'Advert found');
        if (advertOverride) {
          log('info', 'Reuploading legacy advert');
          uploadLegacyAdvert(advertRedirectUrl, advertTargetSize, `${tmpPath}/${filename}`, resolve);
        } else {
          log('info', 'No override set; skipping');
          resolve();
        }
      })
      .catch((error) => {
        log('info', 'Could not find advert on S3, this is normal if the ad is deleted or doesn\'t exist in the first place', error.message);
        uploadLegacyAdvert(advertRedirectUrl, advertTargetSize, `${tmpPath}/${filename}`, resolve);
      });
    }));
  }

  // When the metadata and image have been uploaded this runs or when one of them fails
  Promise.all(promisesToWaitFor).then(() => {
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

router.get('/advert', (req, res) => {
  const { target_size: targetSize } = req.query;
  const searchTerms = [];
  let query = 'select * from adverts';

  if (targetSize) {
    searchTerms.push(targetSize);
    query += ' where target_size=? ';
  }

  db.all(query, searchTerms, (error, result) => {
    if (error) {
      const message = 'Error when retrieving records from database';
      log('error', message, error);
      res.status(500).json({
        success: false,
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

// Need to also modify the advert.json file to ensure its not still there
router.delete('/advert', (req, res) => {
  const { image_name: imageName } = req.query;

  if (!imageName) {
    res.status(400).json({
      success: false,
      message: '`?image_name=` must be provided to identify the advert to remove',
    });
  } else {
    db.all('select * from adverts where image_name=?', [imageName], (error, result) => {
      if (error) {
        res.status(500).json({
          success: false,
          message: `Could not find advert in database: ${error.message}`,
        });
      } else if (result.length !== 0) {
        db.all('select * from adverts where target_size=?', [result[0].target_size], (dbError, adverts) => request(`https://s3.amazonaws.com/${bucket}/${result[0].target_size}/advert.json`)
          .then((currentAd) => {
            const splitImageUrl = JSON.parse(currentAd).image_url.split('/');

            if (splitImageUrl[splitImageUrl.length - 1] === imageName) {
              return res.status(403).json({
                success: false,
                message: 'Cannot delete live adverts',
              });
            }

            if (adverts.length === 1) {
              return res.status(403).json({
                success: false,
                message: 'Cannot delete only advert in this size',
              });
            }

            log('info', 'Deleting', `${result[0].target_size}/${result[0].image_name}`, 'from S3');
            // Potentially delete the advert.json if needed
            // , {
            //   Key: `${result[0].target_size}/advert.json`,
            // }
            const deleter = client.deleteObjects({
              Bucket: bucket,
              Delete: {
                Objects: [{
                  Key: `${result[0].target_size}/${result[0].image_name}`,
                }],
              },
            });

            deleter.on('error', (deleteError) => {
              log('error', 'Error when deleting advert image from S3:', deleteError.message);
              res.status(500).json({
                success: false,
                message: `Error when deleting advert image from S3: ${deleteError.message}`,
              });
            });

            return deleter.on('end', () => {
              log('success', 'Deleted image from S3');

              db.run('delete from adverts where image_name=?', [result[0].image_name], (databaseError) => {
                if (databaseError) {
                  log('error', 'Error when deleting advert from database:', databaseError.message);
                  res.status(500).json({
                    success: false,
                    message: `Error when deleting advert from database: ${databaseError.message}`,
                  });
                } else {
                  log('success', 'Deleted advert from database');
                  res.json({
                    success: true,
                  });
                }
              });
            });
          })
          .catch(error1 => res.status(500).json({
            success: false,
            message: error1.message,
          }))
        );
      } else {
        log('error', 'Could not find image in database');
        res.status(404).json({
          success: false,
          message: 'Advert not found in database, this may need to be manually removed from S3',
        });
      }
    });
  }
});

module.exports = router;
