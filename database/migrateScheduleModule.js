const db = require('../server/config/db');

async function migrateScheduleModule() {
  console.log('🚀 Starting Doctor Schedule & Availability Module Database Migration...');

  // 1. Check and add break times and overrides to doctor_schedules table
  const [columns] = await db.query('DESCRIBE doctor_schedules');
  const colNames = columns.map(c => c.Field);

  if (!colNames.includes('break_start_time')) {
    console.log('Adding break_start_time column to doctor_schedules table...');
    await db.query('ALTER TABLE doctor_schedules ADD COLUMN break_start_time TIME NULL DEFAULT "13:00:00" AFTER end_time');
  }

  if (!colNames.includes('break_end_time')) {
    console.log('Adding break_end_time column to doctor_schedules table...');
    await db.query('ALTER TABLE doctor_schedules ADD COLUMN break_end_time TIME NULL DEFAULT "14:00:00" AFTER break_start_time');
  }

  if (!colNames.includes('room_override')) {
    console.log('Adding room_override column to doctor_schedules table...');
    await db.query('ALTER TABLE doctor_schedules ADD COLUMN room_override VARCHAR(50) NULL AFTER max_patients');
  }

  if (!colNames.includes('department_id')) {
    console.log('Adding department_id column to doctor_schedules table...');
    await db.query('ALTER TABLE doctor_schedules ADD COLUMN department_id INT NULL AFTER room_override');
  }

  // 2. Create doctor_leaves table for leaves, holidays, conferences, and blocked time
  await db.query(`
    CREATE TABLE IF NOT EXISTS doctor_leaves (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doctor_id INT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      leave_type ENUM('annual', 'sick', 'conference', 'emergency', 'casual', 'blocked_time') DEFAULT 'annual',
      reason VARCHAR(255) NULL,
      is_full_day TINYINT(1) DEFAULT 1,
      start_time TIME NULL,
      end_time TIME NULL,
      status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'approved',
      approved_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_doc_leaves (doctor_id, start_date, end_date, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified doctor_leaves table in MySQL.');

  // 3. Update existing schedules to ensure standard break times
  await db.query(`
    UPDATE doctor_schedules 
    SET break_start_time = '13:00:00', break_end_time = '14:00:00' 
    WHERE break_start_time IS NULL
  `);

  // 4. Seed sample approved leaves for demonstration
  // Dr. Marcus Vance on conference in late August
  const [existingLeaves] = await db.query('SELECT id FROM doctor_leaves LIMIT 1');
  if (existingLeaves.length === 0) {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const nextWeekEnd = new Date(today);
    nextWeekEnd.setDate(today.getDate() + 9);

    const fmt = d => d.toISOString().split('T')[0];

    await db.query(`
      INSERT INTO doctor_leaves (doctor_id, start_date, end_date, leave_type, reason, is_full_day, status)
      VALUES 
      (1, ?, ?, 'conference', 'Attending American College of Cardiology Annual Scientific Session', 1, 'approved'),
      (2, ?, ?, 'annual', 'Scheduled summer research symposium', 1, 'approved')
    `, [fmt(nextWeek), fmt(nextWeekEnd), fmt(nextWeek), fmt(nextWeekEnd)]);
    console.log('✅ Seeded sample doctor leaves and conference blocks.');
  }

  console.log('🎉 Doctor Schedule & Availability Module Migration Completed Successfully!');
}

if (require.main === module) {
  migrateScheduleModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateScheduleModule;
