const postgres = require('postgres');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

// Création de la connexion avec Supabase
const sql = postgres(connectionString);

module.exports = sql;

/*
const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  user: process.env.DATABASE_USER,
  host:  process.env.DATABASE_HOST,
  database: process.env.DATABASE_DBNAME,
  password: process.env.DATABASE_PASSWORD,
  port: 5432,
})
client.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
});

module.exports = client;
 */

