const express = require('express');
const handlebars = require('express-handlebars');
const routes = require('./routes/index');
const { log, db } = require('./helpers');
const statusSql = require('./schema/status');
const advertsSql = require('./schema/adverts');

const app = express();

app.engine('handlebars', handlebars({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');
app.use('/public', express.static(`${__dirname}/public`));

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
      }
    });
  } else {
    log('info', 'Database already exists; skipping creation');
  }
});

app.use('/api', routes);

app.get('/', (req, res) => res.render('index'));

app.listen(process.env.PORT || 8000, () => log(
  'info', `Server running on port ${process.env.PORT || 8000}`
));
