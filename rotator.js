const request = require('request-promise-native');
const Cron = require('cron').CronJob;
const fs = require('fs');
const crypto = require('crypto');
const { client, log } = require('./helpers');
const { amazon_bucket: bucket, rotator_api_url: apiUrl } = require('./.env.json');

// Set up the possible sizes we support
const sizes = ['640x960', '500x300', '600x200'];

// This is an in-memory counter for cycling through the ad set, as such it will reset to 0 if the
// app restarts
const indexes = {
  '640x960': 0,
  '500x300': 0,
  '600x200': 0,
};

log('info', 'Rotator started; rotating adverts every 48 hours');

new Cron('30 * * * * *', () => { // eslint-disable-line no-new
  log('info', 'Advert tick');
  const baseUrl = `${apiUrl}/api/advert`;

  sizes.forEach(size => Promise.all([
    request(`${baseUrl}?target_size=${size}`),
    request(`https://s3.amazonaws.com/${bucket}/${size}/advert.json`),
  ]).then(([apiRawResponse, amazonRawResponse]) => {
    const { result: apiResult } = JSON.parse(apiRawResponse);
    const amazonResult = JSON.parse(amazonRawResponse);

    if (apiResult.length === 0) {
      log('warning', 'No adverts available for size', size);
      indexes[size] += 1;
      return false;
    }

    const currentAdvertImageUrl = amazonResult.image_url.split('/');

    // Ensure this next index has something we can use, otherwise we reset to the end as we assume
    // that there are no more adverts
    if (apiResult[indexes[size]] === undefined) {
      indexes[size] = 0;
    }

    const newAdvert = apiResult[indexes[size]];

    if (newAdvert.image_name === currentAdvertImageUrl[currentAdvertImageUrl.length - 1]) {
      // In this case there is likely only one advert available to use so we can just skip as we
      // don't want to reupoad the same advert
      log('warning', 'New advert found is the same as current advert; skipping');
      indexes[size] += 1;
      return false;
    }

    // We now have a new advert that is different to the current one that we can upload. We start by
    // writing out the file to upload
    const tmpFileName = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(`./tmp/${tmpFileName}`, JSON.stringify({
      enabled: amazonResult.enabled,
      image_url: `https://s3.amazonaws.com/${bucket}/${size}/${newAdvert.image_name}`,
      redirect_url: newAdvert.redirect_url,
    }));

    const uploader = client.uploadFile({
      localFile: `./tmp/${tmpFileName}`,
      s3Params: {
        ACL: 'public-read',
        Bucket: bucket,
        Key: `${size}/advert.json`,
      },
    });

    uploader.on('end', () => log('success', `Advert for size ${size} successfully updated, new advert name is ${newAdvert.name}`));

    uploader.on('error', error => log('error', 'Error updating new advert on S3, action has not been completed', error.message));

    indexes[size] += 1;

    return true;
  }).catch(error => log('error', error.message)));
}, null, true, 'Europe/London');
