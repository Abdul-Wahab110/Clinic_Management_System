const { pool } = require('../server/config/db');

async function inspectAppt() {
  const [cols] = await pool.query("SHOW COLUMNS FROM appointments LIKE 'status'");
  console.log(cols[0]);
  process.exit(0);
}
inspectAppt();
