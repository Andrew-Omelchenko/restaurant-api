const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt-nodejs');
const knex = require('knex');
const jwtmod = require('./modules/jwtmod');


// /*
//  ====================   JWT Signing =====================
// */
// const payload = {
//   data1: "Data 1",
//   data2: "Data 2",
//   data3: "Data 3",
//   data4: "Data 4",
// };
// const i  = 'Mysoft corp';   
// const s  = 'some@gmail.com';   
// const a  = 'http://mysoftcorp.in';
// const signOptions = {
//   issuer:  i,
//   subject:  s,
//   audience:  a,
// };
// const token = jwtmod.sign(payload, signOptions);
// console.log("Token :" + token);
// /*
// ====================   JWT Verify =====================
// */
// const verifyOptions = {
//   issuer:  i,
//   subject:  s,
//   audience:  a,
// };
// const legit = jwtmod.verify(token, verifyOptions);
// console.log("\nJWT verification result: " + JSON.stringify(legit));
// /*
// ====================   JWT End   =====================
// */

const db = knex({
  client: 'pg',
  connection: {
    host : '127.0.0.1',
    user : 'postgres',
    password : 'test',
    database : 'restaurant-db'
  }
});

const app = express();

// app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use('/static', express.static(__dirname + '/public'));

/*
(API endpoints)
/ --> GET = Server is working
/signin --> POST = success/fail
/register --> POST = user
/profile/:userId --> GET = user
/menu --> GET = menu
/winecard --> GET = wine card
/hours --> POST = array of hours, reserved for a specific table and date
/reserve --> POST inserts an array of hours into reservations table
/events --> GET = events array
(END)
*/

app.get('/', (req, res) => {
  res.send('Server is working');
});

app.post('/signin', (req, res) => {
  console.log('signin');
  const { email, password } = req.body;
  console.log(email, password);
  db.select('email', 'hash')
    .from('logins')
    .where('email', email)
    .then(data => {
      const isValid = bcrypt.compareSync(password, data[0].hash);
      if (isValid) {
        return db.select('*').from('users')
          .where('email', email)
          .then(users => {
            const payload = users[0];
            const i  = 'localhost';   
            const s  = payload.email;   
            const a  = 'http://localhost:3000';
            const signOptions = {
              issuer:  i,
              subject:  s,
              audience:  a,
            };
            const token = jwtmod.sign(payload, signOptions);
            const verifyOptions = {
              issuer:  i,
              subject:  s,
              audience:  a,
            };
            const legit = jwtmod.verify(token, verifyOptions);
            console.log("\nJWT verification result: " + JSON.stringify(legit));
            res.json({ token: token });
          })
          .catch(err => res.status(400).json('unable to get user'));
      } else {
        res.status(400).json('wrong credentials');
      }
    })
    .catch(err => res.status(400).json('wrong credentials'));
});

app.post('/register', (req, res) => {
  console.log('register');
  const { name, email, password } = req.body;
  console.log(name, email, password);
  const hash = bcrypt.hashSync(password);
  db.transaction(trx => {
    trx.insert({
      email: email,
      hash: hash
    })
    .into('logins')
    .returning('email')
    .then(loginEmails => {
      return trx('users')
        .returning('*')
        .insert({
          name: name,
          email: loginEmails[0],
          joined: new Date()
        })
        .then(users => {
          res.json(users[0]);
        });
    })
    .then(trx.commit)
    .catch(trx.rollback);
  })
  .catch(err => res.status(400).json('unable to register'));
});

app.get('/profile/:id', (req, res) => {
  const { id } = req.params;
  db
    .select('*')
    .from('users')
    .where({ id: id })
    .then(users => {
      if (users.length) {
        res.json(users[0]);
      } else {
        res.status(404).json('no such user');
      }
    })
    .catch(err => res.status(400).json('error getting a user'));
});

app.get('/menu', (req, res) => {
  db
    .select('*')
    .from('menu')
    .then(menu => res.json(menu))
    .catch(err => res.status(400).json('error getting a menu'));
});

app.get('/winecard', (req, res) => {
  db
    .select('*')
    .from('drinks')
    .then(menu => res.json(menu))
    .catch(err => res.status(400).json('error getting a menu'));
});

app.post('/hours', (req, res) => {
  console.log('hours');
  const { tableId, date } = req.body;
  console.log(tableId, date);
  db.select('reserved_hour')
    .from('reservations')
    .where({
      'table_id': tableId, 
      'reserved_date': date
    })
    .then(data => res.json(data))
    .catch(err => res.status(400).json('error getting reserved tables'));
});

app.post('/reserve', (req, res) => {
  console.log('reserve');
  const { email, tableId, date, hours } = req.body;
  const dataArr = hours.map(element => {
    return { 'client_email': email, 'table_id': tableId, 'reserved_date': date, 'reserved_hour': element };
  });
  console.log(dataArr);
  db('reservations')
    .insert(dataArr)
    .then(data => res.json(data))
    .catch(err => res.status(400).json('error inserting hours into reservations table'));
});

app.get('/events', (req, res) => {
  db
    .select('*')
    .from('events')
    .then(menu => res.json(menu))
    .catch(err => res.status(400).json('error getting a menu'));
});

app.listen(3000, () => {
  console.log('Server is running on port 3000.');
});
