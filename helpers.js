const chalk = require('chalk');
const s3 = require('s3');
const sqlite = require('sqlite3').verbose();
const env = require('./.env.json');

const opsviewAdverts = 'opsview-adverts';
const { red, green, yellow, blue, magenta } = chalk;

module.exports = {
  /* eslint-disable no-console */
  log(type = 'info', ...args) {
    switch (type) {
      case 'info': return console.log(magenta(opsviewAdverts), blue(...args));
      case 'error': return console.log(magenta(opsviewAdverts), red(...args));
      case 'success': return console.log(magenta(opsviewAdverts), green(...args));
      case 'warning': return console.log(magenta(opsviewAdverts), yellow(...args));
      default: return console.log(magenta(opsviewAdverts), blue(...args));
    }
  },
  /* eslint-enable no-console */
  client: s3.createClient({
    s3Options: {
      accessKeyId: env.amazon_access_id,
      secretAccessKey: env.amazon_access_key,
    },
  }),
  db: new sqlite.Database('opsview-adverts'),
};
