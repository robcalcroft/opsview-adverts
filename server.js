const express = require('express');
const handlebars = require('express-handlebars');
const auth = require('http-auth');
const routes = require('./routes/index');
const { log, db } = require('./helpers');
const statusSql = require('./schema/status');
const advertsSql = require('./schema/adverts');
const { amazon_bucket, web_base_url } = require('./.env.json');

const app = express();

if (!amazon_bucket) { // eslint-disable-line camelcase
  throw new Error('You need `amazon_bucket` to be present in your .env.json');
}

if (!web_base_url) { // eslint-disable-line camelcase
  throw new Error('No base URL specified, add it in your .env.json');
}

app.engine('handlebars', handlebars({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');
app.use('/public', express.static(`${__dirname}/public`));
app.use(auth.connect(auth.basic({
  realm: 'opsview-adverts',
  file: './users.htpasswd',
})));

db.all('select * from adverts', (error, result) => {
  if (result === undefined) {
    log('info', 'Creating database and tables');
    db.run(advertsSql, (databaseError) => {
      if (databaseError) {
        log('error', 'Error creating adverts table', databaseError);
      } else {
        log('success', 'Adverts table created');
      }
    });
    db.run(statusSql, (databaseError) => {
      if (databaseError) {
        log('error', 'Error creating status table', databaseError);
      } else {
        log('success', 'Status table created');
        log('info', 'Adding advert status record');
        db.run('insert into status (enabled, status_name) values (?, ?)', [false, 'adverts'], (insertError) => {
          if (insertError) {
            log('error', 'Could not add adverts status', insertError.message);
          } else {
            log('success', 'Added adverts status record');
          }
        });
      }
    });
  } else {
    log('info', 'Database already exists; skipping creation');
  }
});

app.use('/api', routes);

app.get('/', (req, res) => res.render('index', { baseUrl: web_base_url }));

app.listen(process.env.PORT || 8000, () => log(
  'info', `Server running on port ${process.env.PORT || 8000}`
));
