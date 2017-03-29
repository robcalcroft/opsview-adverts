const dotenv = require('dotenv');
const winston = require('winston');
const Cron = require('cron').CronJob;
const helpers = require('./helpers.js');

dotenv.load();

const every48Hours = '0 0 0 */2 * *';
// const everySecond = '*/6 * * * * *';

winston.add(winston.transports.File, {
  filename: 'rotator.log',
  json: false,
});
winston.info('Opsview Adverts rotator online ✅');

new Cron(every48Hours, () => { // eslint-disable-line no-new
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line

  // If there are no adverts in the database or just one then we don't need to rotate
  if (db.adverts.length === 1 || db.adverts.length === 0) {
    winston.info(`Only ${db.adverts.length} item(s) in the database; not running on this tick`);
    return false;
  }

  const mobileAdverts = db.adverts.filter(ad => ad.targetSize === '640x960');
  const desktop1Adverts = db.adverts.filter(ad => ad.targetSize === '500x300');
  const desktop2Adverts = db.adverts.filter(ad => ad.targetSize === '600x200');

  // Find the index of the current advert based on the name
  const currentAdvertMobileIndex = db.adverts.map(
    advert => advert.name // eslint-disable-line comma-dangle
  ).indexOf(db.currentAdvertMobile);

  const currentAdvertDesktop1Index = db.adverts.map(
    advert => advert.name // eslint-disable-line comma-dangle
  ).indexOf(db.currentAdvertDesktop1);

  const currentAdvertDesktop2Index = db.adverts.map(
    advert => advert.name // eslint-disable-line comma-dangle
  ).indexOf(db.currentAdvertDesktop2);

  if (currentAdvertMobileIndex === -1) {
    // If the index can't be found in the database, then most likely the advert has been deleted
    // so we need to assign another advert, this is the first one in the list, if thats not
    // available then we just default to an empty string which will cause the next advert added
    // to the database to become the current advert
    winston.warn('No advert matching the currentAdvertMobile found in database; resetting');
    db.currentAdvertMobile = (mobileAdverts[0] && mobileAdverts[0].name) || '';
  } else {
    // Increment the current advert index to find the next advert in the list for the rotation
    // if we have reached the end of the array we go back to the start or worst case set an empty
    // string to force the next advert added to take its place
    db.currentAdvertMobile = (
      (
        mobileAdverts[currentAdvertMobileIndex + 1] &&
        mobileAdverts[currentAdvertMobileIndex + 1].name
      ) ||
      (mobileAdverts[0] && mobileAdverts[0].name) ||
      ''
    );
  }

  if (currentAdvertDesktop1Index === -1) {
    winston.warn('No advert matching the currentAdvertDesktop1 found in database; resetting');
    db.currentAdvertDesktop1 = (desktop1Adverts[0] && desktop1Adverts[0].name) || '';
  } else {
    db.currentAdvertDesktop1 = (
      (
        desktop1Adverts[currentAdvertDesktop1Index + 1] &&
        desktop1Adverts[currentAdvertDesktop1Index + 1].name
      ) ||
      (desktop1Adverts[0] && desktop1Adverts[0].name) ||
      ''
    );
  }

  if (currentAdvertDesktop2Index === -1) {
    winston.warn('No advert matching the currentAdvertDesktop1 found in database; resetting');
    db.currentAdvertDesktop2 = (desktop2Adverts[0] && desktop2Adverts[0].name) || '';
  } else {
    db.currentAdvertDesktop2 = (
      (
        desktop2Adverts[currentAdvertDesktop1Index + 1] &&
        desktop2Adverts[currentAdvertDesktop1Index + 1].name
      ) ||
      (desktop2Adverts[0] && desktop2Adverts[0].name) ||
      ''
    );
  }

  return helpers.writeAndUploadFile('adverts.json', process.env.DATABASE_PATH, JSON.stringify(db), (error) => {
    if (error) {
      winston.error(`Unable to upload ${process.env.DATABASE_PATH} to S3: ${error.stack}`);
    }

    winston.info(`Advert rotation complete ✅, '${db.currentAdvertMobile}' is the current mobile ad, '${db.currentAdvertDesktop1}' is the current desktop1 ad, '${db.currentAdvertDesktop2}' is the current desktop2 ad`);
  });
}, null, true, 'Europe/London');
