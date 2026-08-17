const db = require('../server/config/db');

async function migrateNotificationModule() {
  console.log('🔔 Starting Notification Management Module Database Migration...');

  // 1. Create or Enhance notifications table
  await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      notification_type ENUM(
        'appointment_confirmation',
        'appointment_reminder',
        'appointment_cancellation',
        'lab_report_ready',
        'prescription_created',
        'payment_received',
        'low_stock',
        'system_notification',
        'other'
      ) NOT NULL DEFAULT 'system_notification',
      priority ENUM('urgent', 'high', 'normal', 'low') NOT NULL DEFAULT 'normal',
      action_url VARCHAR(255) NULL,
      reference_id INT NULL,
      reference_type VARCHAR(50) NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      read_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_notif_user_read (user_id, is_read),
      INDEX idx_notif_type (notification_type),
      INDEX idx_notif_created (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  // Check columns and add missing if created in earlier simpler state
  const [cols] = await db.query('DESCRIBE notifications');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('notification_type')) {
    await db.query(`
      ALTER TABLE notifications ADD COLUMN notification_type ENUM(
        'appointment_confirmation',
        'appointment_reminder',
        'appointment_cancellation',
        'lab_report_ready',
        'prescription_created',
        'payment_received',
        'low_stock',
        'system_notification',
        'other'
      ) NOT NULL DEFAULT 'system_notification'
    `);
  }
  if (!colNames.includes('priority')) {
    await db.query("ALTER TABLE notifications ADD COLUMN priority ENUM('urgent', 'high', 'normal', 'low') NOT NULL DEFAULT 'normal'");
  }
  if (!colNames.includes('action_url')) {
    await db.query('ALTER TABLE notifications ADD COLUMN action_url VARCHAR(255) NULL');
  }
  if (!colNames.includes('reference_id')) {
    await db.query('ALTER TABLE notifications ADD COLUMN reference_id INT NULL');
  }
  if (!colNames.includes('reference_type')) {
    await db.query('ALTER TABLE notifications ADD COLUMN reference_type VARCHAR(50) NULL');
  }
  if (!colNames.includes('read_at')) {
    await db.query('ALTER TABLE notifications ADD COLUMN read_at DATETIME NULL');
  }

  console.log('✅ Verified notifications schema with 8 notification modalities.');

  // 2. Seed representative notifications for Admin (User 1), Doctor (User 3), and Patient (User 10)
  const [existingNotifs] = await db.query('SELECT COUNT(*) as count FROM notifications');
  if (existingNotifs[0].count === 0) {
    await db.query(`
      INSERT INTO notifications 
      (user_id, title, message, notification_type, priority, action_url, is_read, created_at)
      VALUES 
      -- Admin Notifications
      (1, 'Low Stock Alert: Amoxicillin 500mg', 'Pharmacy inventory for Amoxicillin 500mg (AMX-500) has fallen below minimum safety threshold (42 / 100 units).', 'low_stock', 'urgent', '/admin/pharmacy', 0, NOW()),
      (1, 'Payment Received: REC-2026-000101', 'Patient Arthur Pendleton settled invoice INV-2026-000101 for $500.00 via Cash counter.', 'payment_received', 'normal', '/admin/billing', 0, NOW()),
      (1, 'System Maintenance Notice', 'Automated database telemetry indexing scheduled at 02:00 AM UTC.', 'system_notification', 'low', '/admin/settings', 1, DATE_SUB(NOW(), INTERVAL 1 DAY)),

      -- Doctor Notifications (User 3 - Dr. Marcus Vance)
      (3, 'Appointment Confirmation: Arthur Pendleton', 'Consultation confirmed for patient Arthur Pendleton on today at 10:00 AM in Room 101.', 'appointment_confirmation', 'high', '/doctor/appointments', 0, NOW()),
      (3, 'Lab Report Ready: Cardiac Troponin-I', 'STAT Lab results for Arthur Pendleton have been verified by Lead Pathologist.', 'lab_report_ready', 'urgent', '/doctor/patients', 0, NOW()),
      (3, 'Appointment Reminder: Sophia Davis', 'Follow-up consultation in 1 hour in Cardiology Examination Suite.', 'appointment_reminder', 'normal', '/doctor/appointments', 0, NOW()),

      -- Patient Notifications (User 10 - Arthur Pendleton)
      (10, 'Appointment Confirmed with Dr. Marcus Vance', 'Your consultation at AuraCare Cardiology Suite is confirmed for today at 10:00 AM.', 'appointment_confirmation', 'high', '/patient/appointments', 0, NOW()),
      (10, 'New Electronic Prescription Available', 'Dr. Marcus Vance has issued Prescription RX-2026-000101 with 3 prescribed medications.', 'prescription_created', 'normal', '/patient/prescriptions', 0, NOW()),
      (10, 'Diagnostic Laboratory Report Ready', 'Your Lipid Profile and Blood Glucose test reports are now ready to view.', 'lab_report_ready', 'normal', '/patient/lab-reports', 1, DATE_SUB(NOW(), INTERVAL 2 DAY)),
      (10, 'Official Payment Receipt Generated', 'Payment of $500.00 acknowledged (Receipt #REC-2026-000101). Thank you.', 'payment_received', 'low', '/patient/invoices', 1, DATE_SUB(NOW(), INTERVAL 2 DAY))
    `);
    console.log('✅ Seeded representative notifications across all 8 modalities.');
  }

  console.log('🎉 Notification Management Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migrateNotificationModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateNotificationModule;
