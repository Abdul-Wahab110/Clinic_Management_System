const { pool } = require('../server/config/db');

async function inspectSchema() {
  const [cols] = await pool.query('DESCRIBE patients');
  console.log('--- PATIENTS TABLE SCHEMA ---');
  for (const c of cols) {
    console.log(`  Field: ${c.Field.padEnd(20)} | Type: ${c.Type.padEnd(30)} | Null: ${c.Null} | Key: ${c.Key} | Default: ${c.Default}`);
  }

  const [userCols] = await pool.query('DESCRIBE users');
  console.log('\n--- USERS TABLE SCHEMA ---');
  for (const c of userCols) {
    console.log(`  Field: ${c.Field.padEnd(20)} | Type: ${c.Type.padEnd(30)} | Null: ${c.Null} | Key: ${c.Key} | Default: ${c.Default}`);
  }

  process.exit(0);
}

inspectSchema().catch(e => { console.error(e); process.exit(1); });
