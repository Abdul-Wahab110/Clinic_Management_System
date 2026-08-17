const { pool } = require('../server/config/db');

async function inspectObjects() {
  console.log('====================================================');
  console.log('🔍 INVESTIGATING 68 DATABASE OBJECTS & CONSTRAINTS');
  console.log('====================================================\n');

  // 1. Full tables and views
  const [fullTables] = await pool.query('SHOW FULL TABLES');
  const tableKey = Object.keys(fullTables[0])[0];
  const typeKey = Object.keys(fullTables[0])[1];

  const baseTables = fullTables.filter(t => t[typeKey] === 'BASE TABLE');
  const views = fullTables.filter(t => t[typeKey] === 'VIEW');

  console.log(`Total Objects Returned by SHOW FULL TABLES: ${fullTables.length}`);
  console.log(`  - Base Tables: ${baseTables.length}`);
  console.log(`  - Views: ${views.length}`);

  if (views.length > 0) {
    console.log('\nViews list:');
    views.forEach((v, i) => console.log(`    ${i + 1}. [VIEW] ${v[tableKey]}`));
  }

  // 2. Count Foreign Keys
  const [fkRows] = await pool.query(`
    SELECT 
      TABLE_NAME, 
      CONSTRAINT_NAME, 
      COLUMN_NAME, 
      REFERENCED_TABLE_NAME, 
      REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() 
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `);
  console.log(`\nTotal Foreign Key Constraints: ${fkRows.length}`);

  // 3. Count Indexes
  const [indexRows] = await pool.query(`
    SELECT DISTINCT 
      TABLE_NAME, 
      INDEX_NAME, 
      NON_UNIQUE
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
  `);
  console.log(`Total Indexes across all tables: ${indexRows.length}`);

  // List all tables
  console.log('\nComplete Table Inventory:');
  for (let i = 0; i < fullTables.length; i++) {
    const name = fullTables[i][tableKey];
    const type = fullTables[i][typeKey];
    console.log(`  ${String(i + 1).padStart(2)}. [${type}] ${name}`);
  }

  process.exit(0);
}

inspectObjects().catch(err => {
  console.error(err);
  process.exit(1);
});
