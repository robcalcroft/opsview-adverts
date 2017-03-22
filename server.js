const express = require('express');
const morgan = require('morgan');
const moment = require('moment');
const expressHandlebars = require('express-handlebars');
const fs = require('fs');
const indexRoutes = require('./routes/index');
const advertRoutes = require('./routes/advert');
const actionsRoutes = require('./routes/actions');

const app = express();
const helpers = require(`${process.env.PWD}/helpers.js`); // eslint-disable-line

// Create database if it doesn't exist
if (!fs.existsSync(process.env.DATABASE_PATH)) {
  fs.writeFileSync(process.env.DATABASE_PATH, JSON.stringify({
    adverts_status: false,
    adverts: [],
  }));
}

helpers.doesFileExist('adverts.json', (doesExist) => {
  if (!doesExist) {
    console.log(`${new Date()}`, 'Adverts database not available on S3, uploading...');
    const doesExistLocally = fs.existsSync(process.env.DATABASE_PATH) ? false : JSON.stringify({
      adverts_status: false,
      adverts: [],
    });
    helpers.writeAndUploadFile('adverts.json', process.env.DATABASE_PATH, doesExistLocally, (error) => {
      if (error) {
        throw new Error('Could not upload adverts database to S3');
      }

      console.log(`${new Date()}`, 'Adverts database uploaded to S3');
    });
  } else {
    console.log(`${new Date()}`, 'Adverts database exists on S3');
  }
});

// Add our helpers
const handlebars = expressHandlebars.create({
  defaultLayout: 'main',
  helpers: {
    created: time => moment.unix(time).fromNow(),
  },
});

// Setup
app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.use('/public', express.static('public'));
app.use(morgan('combined'));

// Inject routes
app.use('/', indexRoutes, advertRoutes, actionsRoutes);

// Add catching routes
app.get('*', (req, res) => res.render('404'));
app.post('*', (req, res) => res.sendStatus(404));

app.listen(process.env.PORT, () => console.log(`${new Date()}`, 'Opsview Adverts server online ✅'));
