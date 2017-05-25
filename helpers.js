const chalk = require('chalk');
const s3 = require('s3');
const sqlite = require('sqlite3').verbose();
const env = require('./.env.json');
const crypto = require('crypto');
const child = require('child_process');
const fs = require('fs');

const opsviewAdverts = 'opsview-adverts';
const { red, green, yellow, blue, magenta } = chalk;

/* eslint-disable no-console */
const log = (type = 'info', ...args) => {
  switch (type) {
    case 'info': return console.log(magenta(opsviewAdverts), blue(...args));
    case 'error': return console.log(magenta(opsviewAdverts), red(...args));
    case 'success': return console.log(magenta(opsviewAdverts), green(...args));
    case 'warning': return console.log(magenta(opsviewAdverts), yellow(...args));
    default: return console.log(magenta(opsviewAdverts), blue(...args));
  }
};
/* eslint-enable no-console */

const client = s3.createClient({
  s3Options: {
    accessKeyId: env.amazon_access_id,
    secretAccessKey: env.amazon_access_key,
  },
});

const db = new sqlite.Database('opsview-adverts');

const targetSizeLegacyMap = {
  '500x300': 'login',
  '600x200': 'reload',
  '640x960': 'phone',
};

const uploadLegacyAdvert = (
  advertRedirectUrl,
  advertTargetSize,
  uploadedImageFilePath,
  done
) => {
  const html = `<html><body><a href="https://s3.amazonaws.com/${env.amazon_bucket}/opsview-ad-${targetSizeLegacyMap[advertTargetSize]}-redirect.html" target="_blank"><img src="https://s3.amazonaws.com/${env.amazon_bucket}/opsview-ad-${targetSizeLegacyMap[advertTargetSize]}.png" width="100%" ></a></body></html>`;
  const redirectHTML = `<html><head><meta http-equiv="refresh" content="0; URL='${advertRedirectUrl}'" /></head></html>`;
  const htmlFileName = `opsview-ad-${targetSizeLegacyMap[advertTargetSize]}.html`;
  const redirectHTMLFileName = `opsview-ad-${targetSizeLegacyMap[advertTargetSize]}-redirect.html`;
  const htmlFilePath = `./tmp/${htmlFileName}`;
  const redirectHTMLFilePath = `./tmp/${redirectHTMLFileName}`;

  // Write out our files
  fs.writeFileSync(redirectHTMLFilePath, redirectHTML);
  fs.writeFileSync(htmlFilePath, html);

  const filePromiseFactory = (
    localPath,
    name,
    size,
    type
  ) => new Promise((resolveUpload, rejectUpload) => {
    const uploader = client.uploadFile({
      localFile: localPath,
      s3Params: {
        ACL: 'public-read',
        Bucket: env.amazon_bucket,
        Key: name,
      },
    });

    uploader.on('end', () => {
      log('success', `Legacy advert ${type} file for size ${size} uploaded`);

      // Attempt to delete the temp file we created as cleanup
      try {
        fs.unlinkSync(localPath);
      } catch (error) {
        log('warning', `Error removing temporary ${type} file, this should be cleaned up by the OS`);
      }

      resolveUpload();
    });

    uploader.on('error', error => rejectUpload(error));
  });

  Promise.all([
    filePromiseFactory(htmlFilePath, htmlFileName, advertTargetSize, 'html'),
    filePromiseFactory(redirectHTMLFilePath, redirectHTMLFileName, advertTargetSize, 'redirect'),
    filePromiseFactory(uploadedImageFilePath, `opsview-ad-${targetSizeLegacyMap[advertTargetSize]}.png`, advertTargetSize, 'image'),
  ]).then(done)
  .catch((error) => {
    log('error', 'Error uploading part of the legact advert, this may need to be manually resolved', error.message);
    done();
  });
};

const downloadImageAndUploadLegacyAdvert = (advertData, tmpPath, done) => {
  const sizeSplit = advertData.image_url.split('/');
  const size = sizeSplit[sizeSplit.length - 2];
  const tmpFileName = crypto.randomBytes(32).toString('hex');
  const imagePath = `${tmpPath}/${tmpFileName}`;

  log('info', 'Looking for S3 advert for legacy adverts', advertData.image_url);
  child.exec(`curl ${advertData.image_url} > ${imagePath}`, (error, stdout, stderror) => {
    if (error) {
      log('error', 'Could not download image file from S3. Marked as success but will need to be resolved manually', stderror);
      return done();
    }
    log('info', 'Downloaded copy of current advert for legacy upload, uploading to S3');
    return uploadLegacyAdvert(
      advertData.redirect_url,
      size,
      imagePath,
      done
    );
  });
};

module.exports = {
  log,
  db,
  client,
  uploadLegacyAdvert,
  downloadImageAndUploadLegacyAdvert,
  targetSizeLegacyMap,
};
