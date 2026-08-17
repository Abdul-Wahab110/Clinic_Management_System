const db = require('../server/config/db');

async function migrateSettingsModule() {
  console.log('⚙️ Starting Hospital Settings Module Database Migration...');

  // 1. Create hospital_settings table
  await db.query(`
    CREATE TABLE IF NOT EXISTS hospital_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      hospital_name VARCHAR(255) NOT NULL DEFAULT 'AuraCare Medical Center & Super Specialty Institute',
      hospital_tagline VARCHAR(255) NULL DEFAULT 'Excellence in Comprehensive Healthcare & Specialized Medicine',
      logo_url VARCHAR(500) NULL DEFAULT '/img/logo.png',
      phone VARCHAR(50) NOT NULL DEFAULT '+1 (800) 555-CARE',
      email VARCHAR(100) NOT NULL DEFAULT 'concierge@auracare.org',
      address TEXT NOT NULL,
      emergency_number VARCHAR(50) NOT NULL DEFAULT '+1 (800) 911-AURA',
      opening_hours VARCHAR(255) NOT NULL DEFAULT 'Mon - Sat: 08:00 AM - 08:00 PM | Emergency 24/7',
      currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
      currency_symbol VARCHAR(10) NOT NULL DEFAULT '$',
      timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
      invoice_prefix VARCHAR(20) NOT NULL DEFAULT 'INV-2026-',
      patient_prefix VARCHAR(20) NOT NULL DEFAULT 'PAT-2026-',
      appointment_duration_minutes INT NOT NULL DEFAULT 30,
      allow_online_booking TINYINT(1) NOT NULL DEFAULT 1,
      max_advance_booking_days INT NOT NULL DEFAULT 60,
      cancellation_lead_hours INT NOT NULL DEFAULT 12,
      email_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
      sms_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
      appointment_reminders_enabled TINYINT(1) NOT NULL DEFAULT 1,
      low_stock_alerts_enabled TINYINT(1) NOT NULL DEFAULT 1,
      updated_by INT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  // 2. Ensure initial row exists
  const [rows] = await db.query('SELECT id FROM hospital_settings LIMIT 1');
  if (rows.length === 0) {
    await db.query(`
      INSERT INTO hospital_settings (
        id,
        hospital_name,
        hospital_tagline,
        logo_url,
        phone,
        email,
        address,
        emergency_number,
        opening_hours,
        currency_code,
        currency_symbol,
        timezone,
        invoice_prefix,
        patient_prefix,
        appointment_duration_minutes,
        allow_online_booking,
        max_advance_booking_days,
        cancellation_lead_hours,
        email_notifications_enabled,
        sms_notifications_enabled,
        appointment_reminders_enabled,
        low_stock_alerts_enabled
      ) VALUES (
        1,
        'AuraCare Medical Center & Super Specialty Institute',
        'Excellence in Comprehensive Healthcare & Specialized Medicine',
        '/img/logo.png',
        '+1 (800) 555-CARE',
        'concierge@auracare.org',
        '742 Evergreen Healthcare Pavilion, Medical District, NY 10001, United States',
        '+1 (800) 911-AURA',
        'Mon - Sat: 08:00 AM - 08:00 PM | Emergency 24/7',
        'USD',
        '$',
        'America/New_York',
        'INV-2026-',
        'PAT-2026-',
        30,
        1,
        60,
        12,
        1,
        1,
        1,
        1
      )
    `);
    console.log('✅ Initialized default hospital settings in MySQL.');
  }

  console.log('🎉 Hospital Settings Module Migration Completed Successfully!');
}

if (require.main === module) {
  migrateSettingsModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateSettingsModule;
