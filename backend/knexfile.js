require('dotenv').config();
const path = require('path');
const config = require('./src/config');

const usePostgres = process.env.DB_CLIENT === 'pg' || !!process.env.DATABASE_URL;

module.exports = {
  development: usePostgres
    ? {
        client: 'pg',
        connection: process.env.DATABASE_URL
          ? {
              connectionString: process.env.DATABASE_URL,
              ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
            }
          : {
              host: config.db.host,
              port: config.db.port,
              database: config.db.name,
              user: config.db.user,
              password: config.db.password,
            },
        pool: { min: 2, max: 10 },
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
    pool: { min: 2, max: 20 },
    migrations: { directory: './migrations', tableName: 'knex_migrations' },
  },
};
