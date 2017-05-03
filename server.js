const express = require('express');
const handlebars = require('express-handlebars');
const routes = require('./routes/index');
const { log, db } = require('./helpers');

const app = express();

app.engine('handlebars', handlebars({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');
app.use('/public', express.static(`${__dirname}/public`));

db.all('select * from adverts', (error, result) => {
  if (result === undefined) {
    log('info', 'Creating database table');
    db.run(`
      create table adverts (
        
      )
    `);
  } else {
    log('info', 'Database already exists; skipping creation');
  }
});

app.use('/', routes);

app.get('/', (req, res) => res.render('index'));

app.listen(process.env.PORT || 8000, () => log(
  'info', `Server running on port ${process.env.PORT || 8000}`
));
