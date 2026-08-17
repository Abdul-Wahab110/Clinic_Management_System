const { pool } = require('../server/config/db');

async function auditDatabase() {
  console.log('====================================================');
  console.log('🗄️ MYSQL DATABASE SCHEMA & INTEGRITY AUDIT');
  console.log('====================================================\n');

  const [tables] = await pool.query('SHOW TABLES');
  const tableKey = Object.keys(tables[0])[0];
  const tableNames = tables.map(t => t[tableKey]);

  console.log(`Total Tables in Database: ${tableNames.length}\n`);

  let totalRows = 0;
  for (const table of tableNames) {
    const [[countResult]] = await pool.query(`SELECT COUNT(*) as count FROM \`${table}\``);
    const [cols] = await pool.query(`DESCRIBE \`${table}\``);
    const primaryKey = cols.find(c => c.Key === 'PRI')?.Field || 'None';
    totalRows += countResult.count;
    console.log(`  📊 Table: ${table.padEnd(28)} | Rows: ${String(countResult.count).padStart(4)} | PK: ${primaryKey} | Columns: ${cols.length}`);
  }

  console.log(`\nTotal Records Across All Tables: ${totalRows}`);
  console.log('====================================================\n');

  process.exit(0);
}

auditDatabase().catch(err => {
  console.error(err);
  process.exit(1);
});
