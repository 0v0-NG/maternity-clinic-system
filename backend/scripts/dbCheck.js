require('dotenv').config();
const db = require('../src/config/database');

async function checkDatabase() {
  try {
    const client = db.client.config.client;
    const isPg = client === 'pg';

    let version = 'unknown';
    let tables = [];

    if (isPg) {
      const res = await db.raw('SELECT version()');
      version = res.rows && res.rows[0] ? res.rows[0].version : 'PostgreSQL';

      const tableRes = await db.raw(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
      );
      tables = tableRes.rows.map((r) => r.table_name);
    } else {
      const res = await db.raw('SELECT sqlite_version() as version');
      version = res[0] ? `SQLite ${res[0].version}` : 'SQLite';

      const tableRes = await db.raw(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );
      tables = tableRes.map((r) => r.name);
    }

    const dbUrl = process.env.DATABASE_URL || '';
    const isNeonHost = dbUrl.toLowerCase().includes('neon.tech') ? 'yes' : 'no';

    console.log('--- DATABASE CHECK ---');
    console.log(`Database Engine : ${client}`);
    console.log(`Server Version  : ${version}`);
    console.log(`Neon Host       : ${isNeonHost}`);
    console.log(`Tables (${tables.length})     : ${tables.join(', ') || 'None'}`);
    console.log('-----------------------');

    process.exit(0);
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  } finally {
    await db.destroy().catch(() => {});
  }
}

checkDatabase();
