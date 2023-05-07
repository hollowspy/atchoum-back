const { Client } = require('pg')

// const client = new Client({
//     user: 'postgres',
//     host: 'localhost',
//     database: 'unkle',
//     password: 'Jn8bb11',
//     port: 5432,
// })
const client = new Client({
  user: 'mpvxxzim',
  host: 'horton.db.elephantsql.com',
  database: 'mpvxxzim',
  password: 'y1XjDLOOS2_X0hNONWO7Ik7MUzBDAhFZ',
  port: 5432,
})
client.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});

module.exports = client;
