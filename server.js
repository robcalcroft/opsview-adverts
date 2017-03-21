const express = require('express');
const morgan = require('morgan');
const expressHandlebars = require('express-handlebars');
const fs = require('fs');
const indexRoutes = require('./routes/index');
const advertRoutes = require('./routes/advert');
const actionsRoutes = require('./routes/actions');

const app = express();

// Create database if it doesn't exist
if (!fs.existsSync(process.env.DATABASE_PATH)) {
  fs.writeFileSync(process.env.DATABASE_PATH, JSON.stringify({
    adverts_status: false,
    adverts: [],
  }));
}

// Setup
app.engine('handlebars', expressHandlebars({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');
app.use('/public', express.static('public'));
app.use(morgan('combined'));

// Inject routes
app.use('/', indexRoutes, advertRoutes, actionsRoutes);

// Add catching routes
app.get('*', (req, res) => res.render('404'));
app.post('*', (req, res) => res.sendStatus(404));

app.listen(process.env.PORT);
