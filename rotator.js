const dotenv = require('dotenv');
const winston = require('winston');
const Cron = require('cron').CronJob;
const helpers = require('./helpers.js');

dotenv.load();

// const every48Hours = '0 0 0 */2 * *';
const everySecond = '30 * * * * *';

winston.add(winston.transports.File, {
  filename: 'rotator.log',
  json: false,
});
winston.info('Opsview Adverts rotator online ✅');

new Cron(everySecond, () => { // eslint-disable-line no-new
  const db = require(process.env.DATABASE_PATH); // eslint-disable-line

  // If there are no adverts in the database or just one then we don't need to rotate
  if (db.adverts.length === 1 || db.adverts.length === 0) {
    winston.info(`Only ${db.adverts.length} item(s) in the database; not running on this tick`);
    return false;
  }

  // Find the index of the current advert based on the name
  const currentAdvertIndex = db.adverts.map(
    advert => advert.name // eslint-disable-line comma-dangle
  ).indexOf(db.currentAdvertName);

  if (currentAdvertIndex === -1) {
    // If the index can't be found in the database, then most likely the advert has been deleted
    // so we need to assign another advert, this is the first one in the list, if thats not
    // available then we just default to an empty string which will cause the next advert added
    // to the database to become the current advert
    winston.warn('No advert matching the currentAdvertName found in database; resetting');
    db.currentAdvertName = (db.adverts[0] && db.adverts[0].name) || '';
  } else {
    // Increment the current advert index to find the next advert in the list for the rotation
    // if we have reached the end of the array we go back to the start or worst case set an empty
    // string to force the next advert added to take its place
    db.currentAdvertName = (
      (db.adverts[currentAdvertIndex + 1] && db.adverts[currentAdvertIndex + 1].name) ||
      (db.adverts[0] && db.adverts[0].name) ||
      ''
    );
  }

  return helpers.writeAndUploadFile('adverts.json', process.env.DATABASE_PATH, JSON.stringify(db), (error) => {
    if (error) {
      winston.error(`Unable to upload ${process.env.DATABASE_PATH} to S3: ${error.stack}`);
    }

    winston.info(`Advert rotation complete ✅, '${db.currentAdvertName}' is the current advert`);
  });
}, null, true, 'Europe/London');
