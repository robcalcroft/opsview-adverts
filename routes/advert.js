const express = require('express');
const fs = require('fs');
const multer = require('multer')({ dest: 'tmp/' });
const s3 = require('s3');
const dotenv = require('dotenv');

dotenv.load();

const client = s3.createClient({
  s3Options: {
    accessKeyId: process.env.AMAZON_ACCESS_KEY,
    secretAccessKey: process.env.AMAZON_SECRET,
  },
});
const router = express.Router();

router.get('/advert', (req, res) => res.render('advert'));

router.post('/advert', multer.single('advert_image'), (req, res) => {
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line
  const oneMb = 1000000;
  const bucket = 'opsview-adverts-testing';

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
  let fileName = new Buffer(`${req.file.originalname}-${new Date().getTime()}`).toString('base64');
  fileName += `.${req.file.mimetype.split('/')[1]}`;
  const newFileLocation = `${process.env.PWD}/adverts/${fileName}`;

  // Move file to adverts folder
  fs.renameSync(`${process.env.PWD}/${req.file.path}`, newFileLocation);

  // Add the new advert to the database
  db.adverts.push({
    advertName: req.body.advert_name,
    targetVersion: req.body.target_version,
    redirectUrl: req.body.redirect_url,
    created: ~~(new Date().getTime() / 1000), // eslint-disable-line no-bitwise
    s3Url: `https://s3.amazonaws.com/${bucket}/${fileName}`,
    fileName,
  });

  fs.writeFileSync(process.env.DATABASE_PATH, JSON.stringify(db));

  // Start the upload for the database file, it overwrites if it exists
  const databaseUploader = client.uploadFile({
    localFile: process.env.DATABASE_PATH,
    deleteRemoved: true,
    s3Params: {
      ACL: 'public-read',
      Bucket: bucket,
      Key: 'adverts.json',
    },
  });

  databaseUploader.on('error', error => res.render('advert', { error: `Unable to sync: ${error.stack}` }));

  return databaseUploader.on('end', () => {
    // Start the upload for the image
    const imageUploader = client.uploadFile({
      localFile: newFileLocation,
      deleteRemoved: true,
      s3Params: {
        ACL: 'public-read',
        Bucket: bucket,
        Key: fileName,
      },
    });

    // Should remove entry from databse if we get an error here
    imageUploader.on('error', error => res.render('advert', { error: `Unable to sync: ${error.stack}` }));

    imageUploader.on('end', () => res.render('advert', { success: `New advert ${req.body.advert_name} added to S3` }));
  });
});

module.exports = router;
