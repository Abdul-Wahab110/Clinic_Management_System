const { pool } = require('../server/config/db');

async function inspectHospitalSettings() {
  const [cols] = await pool.query('DESCRIBE hospital_settings');
  console.log('Columns:', cols);
  const [rows] = await pool.query('SELECT * FROM hospital_settings');
  console.log('Rows:', rows);
  process.exit(0);
}
inspectHospitalSettings().catch(e => { console.error(e); process.exit(1); });
