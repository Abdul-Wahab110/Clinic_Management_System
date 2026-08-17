const { pool } = require('../server/config/db');

async function inspectTables() {
  const [tables] = await pool.query('SHOW TABLES');
  console.log('Tables:', tables.map(t => Object.values(t)[0]));
  const [settings] = await pool.query('SELECT * FROM system_settings LIMIT 20');
  console.log('Settings:', settings);
  process.exit(0);
}
inspectTables().catch(e => { console.error(e); process.exit(1); });
