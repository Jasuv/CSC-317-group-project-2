require("dotenv").config();
const { Pool } = require("pg");

const connectionString = `postgresql://${process.env.PG_USER}:${process.env.PG_PASSWORD}@${process.env.PG_HOST}:5432/${process.env.PG_DATABASE}?sslmode=${process.env.PG_SSL_MODE}`;

const pool = new Pool({
  connectionString,
});

module.exports = pool;
