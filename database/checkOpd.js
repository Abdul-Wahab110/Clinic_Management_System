const { pool } = require('../server/config/db');

async function checkOpdCols() {
  const [cols] = await pool.query('DESCRIBE opd_queues');
  console.log(cols.map(c => c.Field));
  const [rows] = await pool.query('SELECT id, department_id, queue_date, token_sequence FROM opd_queues');
  console.log(rows);
  process.exit(0);
}
checkOpdCols();
