const { pool } = require('../server/config/db');

async function migrate() {
  console.log('--- Migrating Database Schema & Permissions ---');

  // 1. Update appointments status enum to support 'accepted' and 'rejected'
  await pool.query(`
    ALTER TABLE appointments 
    MODIFY COLUMN status ENUM('pending', 'accepted', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'rejected', 'no_show') DEFAULT 'pending'
  `);
  console.log('✅ appointments.status ENUM updated');

  // 2. Check if rejected_by, rejected_at, rejection_reason columns exist
  const [cols] = await pool.query('DESCRIBE appointments');
  const colNames = cols.map(c => c.Field);
  
  if (!colNames.includes('rejected_by')) {
    await pool.query('ALTER TABLE appointments ADD COLUMN rejected_by INT NULL');
    console.log('✅ Added rejected_by to appointments');
  }
  if (!colNames.includes('rejected_at')) {
    await pool.query('ALTER TABLE appointments ADD COLUMN rejected_at DATETIME NULL');
    console.log('✅ Added rejected_at to appointments');
  }
  if (!colNames.includes('rejection_reason')) {
    await pool.query('ALTER TABLE appointments ADD COLUMN rejection_reason TEXT NULL');
    console.log('✅ Added rejection_reason to appointments');
  }

  // 3. Grant Super Admin (role_id = 1) ALL permissions in permissions table
  const [allPerms] = await pool.query('SELECT id FROM permissions');
  const [superAdminPerms] = await pool.query('SELECT permission_id FROM role_permissions WHERE role_id = 1');
  const existingSet = new Set(superAdminPerms.map(p => p.permission_id));
  
  const missingPerms = allPerms.filter(p => !existingSet.has(p.id));
  if (missingPerms.length > 0) {
    const values = missingPerms.map(p => [1, p.id]);
    await pool.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [values]);
    console.log(`✅ Granted ${missingPerms.length} missing permissions to Super Admin`);
  } else {
    console.log('✅ Super Admin already has all permissions');
  }

  // 4. Ensure system_settings table/view exists as alias to hospital_settings
  await pool.query(`
    CREATE OR REPLACE VIEW system_settings AS 
    SELECT 
      id,
      hospital_name as site_name,
      hospital_tagline as site_tagline,
      logo_url as site_logo,
      email as site_email,
      phone as site_phone,
      address as site_address,
      emergency_number as site_emergency,
      currency_code,
      currency_symbol,
      updated_at
    FROM hospital_settings
  `);
  console.log('✅ Created system_settings view');

  console.log('\n--- Database Migration Complete ---');
  process.exit(0);
}

migrate().catch(e => {
  console.error('Migration error:', e);
  process.exit(1);
});
