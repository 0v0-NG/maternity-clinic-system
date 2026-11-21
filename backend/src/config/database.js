const config = require('./index');
const knex = require('knex');
const path = require('path');

/**
 * Knex database configuration.
 * Automatically chooses PostgreSQL if DATABASE_URL or DB_PASSWORD is provided,
 * otherwise falls back to SQLite (dev.sqlite3) for instant zero-configuration local testing.
 */
const usePostgres = process.env.DB_CLIENT === 'pg' || !!process.env.DATABASE_URL;

const dbConfig = usePostgres
  ? {
    client: 'pg',
    connection: process.env.DATABASE_URL
      ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }
      : {
        host: config.db.host,
        port: config.db.port,
        database: config.db.name,
        user: config.db.user,
        password: config.db.password,
      },
    pool: { min: 2, max: 10 },
    migrations: { directory: path.join(__dirname, '../../migrations'), tableName: 'knex_migrations' },
    seeds: { directory: path.join(__dirname, '../../seeds') },
  }
  : {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, '../../dev.sqlite3'),
    },
    useNullAsDefault: true,
    migrations: { directory: path.join(__dirname, '../../migrations'), tableName: 'knex_migrations' },
    seeds: { directory: path.join(__dirname, '../../seeds') },
  };

const db = knex(dbConfig);

module.exports = db;
