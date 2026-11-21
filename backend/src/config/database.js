const config = require('./index');
const knex = require('knex');
const path = require('path');
const pg = require('pg');

/**
 * Configure node-pg type parsers so PostgreSQL output matches SQLite:
 * 1. OID 1082 (DATE) -> Return as exact 'YYYY-MM-DD' string instead of JS Date object.
 * 2. OID 20 (INT8/BIGINT, e.g. COUNT(*)) -> Return as integer number.
 * 3. OID 1700 (NUMERIC, e.g. ROUND/PERCENTAGES) -> Return as float number.
 */
pg.types.setTypeParser(1082, (val) => val);
pg.types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
pg.types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

/**
 * Knex database configuration.
 * Automatically chooses SQLite in-memory for testing,
 * chooses PostgreSQL if DB_CLIENT=pg or DATABASE_URL is provided,
 * otherwise falls back to SQLite (dev.sqlite3) for instant zero-configuration local testing.
 */
const isTest = process.env.NODE_ENV === 'test';
const usePostgres = !isTest && (process.env.DB_CLIENT === 'pg' || !!process.env.DATABASE_URL);

const dbConfig = isTest
  ? {
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
      },
      useNullAsDefault: true,
      pool: { min: 1, max: 1 },
      migrations: { directory: path.join(__dirname, '../../migrations'), tableName: 'knex_migrations' },
      seeds: { directory: path.join(__dirname, '../../seeds') },
    }
  : usePostgres
  ? {
      client: 'pg',
      connection: process.env.DATABASE_URL
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10000,
          }
        : {
            host: config.db.host,
            port: config.db.port,
            database: config.db.name,
            user: config.db.user,
            password: config.db.password,
          },
      pool: {
        min: 0,
        max: 5,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 5000,
        reapIntervalMillis: 1000,
        afterCreate: (connection, done) => {
          connection.on('error', (err) => {
            console.warn('[DB] Handled pool connection error:', err.message);
          });
          done(null, connection);
        },
        validate: (client) => {
          return !client._ending && client.connection && !client.connection.stream?.destroyed;
        },
      },
      acquireConnectionTimeout: 30000,
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
