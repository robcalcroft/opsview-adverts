const express = require('express');
const app = express();
const multer = require('multer')({ dest: 'tmp/' });
const morgan = require('morgan');
const expressHandlebars = require('express-handlebars');
const fs = require('fs');
const dbPath = './db.json';

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({
    adverts_status: false,
    adverts: [],
  }));
}

app.engine('handlebars', expressHandlebars({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');
app.use('/public', express.static('public'));
app.use(morgan('combined'));

app.get('/', (req, res) => {
  const db = require(dbPath);

  res.render('index', {
    adverts_status: db.adverts_status,
    adverts_status_toggled: !db.adverts_status,
  })
});
app.get('*', (req, res) => res.render('404'));

app.post('/advert', multer.single('advert_image'), (req, res) => {
  const source = fs.createReadStream(req.file.path);
  const destination = fs.createWriteStream(`adverts/${req.file.originalname}`);

  source.pipe(destination);
  source.on('end', () => {
    const db = require(dbPath);

    // Add to S3 here

    db.adverts.push({
      campaignName: req.body.campaign_name,
      targetVersion: req.body.target_version,
      image: req.file.originalname,
    });

    fs.writeFileSync(dbPath, JSON.stringify(db));

    res.render('index', {
      success: `New campaign ${req.body.campaign_name} added`,
    });
  });
  source.on('error', (err) => {
    res.render('index', {
      error: 'Error adding campaign',
    });
  });
});

app.post('/action', multer.array(), (req, res) => {
  const advertsStatus = req.body.toggle_adverts_status === 'true';
  const db = require(dbPath);

  db.adverts_status = advertsStatus;

  fs.writeFileSync(dbPath, JSON.stringify(db));

  res.render('index', {
    adverts_status: db.adverts_status,
    adverts_status_toggled: !db.adverts_status,
    success: `Adverts ${advertsStatus ? 'enabled' : 'disabled'}`,
  });
});

app.listen(process.env.PORT);
