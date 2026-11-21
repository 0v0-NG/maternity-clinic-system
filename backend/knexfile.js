require('dotenv').config();
const path = require('path');
const config = require('./src/config');
const pg = require('pg');

// Configure node-pg type parsers so PostgreSQL output matches SQLite
pg.types.setTypeParser(1082, (val) => val);
pg.types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
pg.types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));

const usePostgres = process.env.DB_CLIENT === 'pg' || !!process.env.DATABASE_URL;

module.exports = {
  development: usePostgres
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
        pool: {
          min: 0,
          max: 5,
          acquireTimeoutMillis: 30000,
          createTimeoutMillis: 30000,
          destroyTimeoutMillis: 5000,
          idleTimeoutMillis: 30000,
          reapIntervalMillis: 1000,
        },
        acquireConnectionTimeout: 30000,
        migrations: { directory: './migrations', tableName: 'knex_migrations' },
        seeds: { directory: './seeds' },
      }
    : {
        client: 'sqlite3',
        connection: {
          filename: path.join(__dirname, 'dev.sqlite3'),
        },
        useNullAsDefault: true,
        migrations: { directory: './migrations', tableName: 'knex_migrations' },
        seeds: { directory: './seeds' },
      },

  test: {
    client: 'sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
    migrations: { directory: './migrations', tableName: 'knex_migrations' },
  },

  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    },
    pool: {
      min: 0,
      max: 5,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
    },
    acquireConnectionTimeout: 30000,
    migrations: { directory: './migrations', tableName: 'knex_migrations' },
  },
};

