const { pool } = require('../server/config/db');

async function cleanDebug() {
  const [users] = await pool.query('SELECT id FROM users WHERE email = ?', ['shahzarnab796@gmail.com']);
  if (users.length > 0) {
    const userId = users[0].id;
    await pool.query('DELETE FROM patients WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM audit_logs WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    console.log(`Cleaned up test user ${userId} (shahzarnab796@gmail.com)`);
  } else {
    console.log('No user to clean up.');
  }
  process.exit(0);
}

cleanDebug().catch(e => { console.error(e); process.exit(1); });
