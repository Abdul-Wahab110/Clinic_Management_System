const db = require('../server/config/db');

async function migrateContactModule() {
  console.log('📬 Starting Contact & Inquiry Management Module Database Migration...');

  // 1. Create or upgrade contact_messages table
  await db.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(50) NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      department_id INT NULL,
      inquiry_type VARCHAR(100) NOT NULL DEFAULT 'General Inquiry',
      status ENUM('new', 'read', 'replied', 'archived') NOT NULL DEFAULT 'new',
      reply_notes TEXT NULL,
      replied_by INT NULL,
      replied_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
      FOREIGN KEY (replied_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_contact_status (status),
      INDEX idx_contact_type (inquiry_type),
      INDEX idx_contact_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  // Ensure all columns exist if table pre-existed
  const [cols] = await db.query('DESCRIBE contact_messages');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('department_id')) {
    await db.query('ALTER TABLE contact_messages ADD COLUMN department_id INT NULL AFTER message');
  }
  if (!colNames.includes('inquiry_type')) {
    await db.query("ALTER TABLE contact_messages ADD COLUMN inquiry_type VARCHAR(100) NOT NULL DEFAULT 'General Inquiry' AFTER department_id");
  }
  if (!colNames.includes('reply_notes')) {
    await db.query('ALTER TABLE contact_messages ADD COLUMN reply_notes TEXT NULL AFTER status');
  }
  if (!colNames.includes('replied_by')) {
    await db.query('ALTER TABLE contact_messages ADD COLUMN replied_by INT NULL AFTER reply_notes');
  }
  if (!colNames.includes('replied_at')) {
    await db.query('ALTER TABLE contact_messages ADD COLUMN replied_at DATETIME NULL AFTER replied_by');
  }
  if (!colNames.includes('updated_at')) {
    await db.query('ALTER TABLE contact_messages ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  }

  // 2. Seed initial realistic contact inquiries
  const [countRows] = await db.query('SELECT COUNT(*) as count FROM contact_messages');
  if (countRows[0].count === 0) {
    await db.query(`
      INSERT INTO contact_messages 
      (name, email, phone, subject, message, department_id, inquiry_type, status, reply_notes, replied_by, replied_at, created_at)
      VALUES 
      (
        'Sophia Martinez', 'sophia.m@example.com', '+1 (555) 234-8899',
        'Inquiry on Specialized Pediatric Cardiology Consultations',
        'Hello, I would like to know if Dr. Marcus Vance accepts referrals for pediatric arrhythmias or if there is a dedicated pediatric cardiologist on staff on Saturdays?',
        1, 'Appointment Question', 'new', NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 2 HOUR)
      ),
      (
        'David Harrison', 'david.h@example.com', '+1 (555) 345-6677',
        'Insurance Coverage & Billing Estimates for MRI Scans',
        'Good day, could you please confirm if BlueCross PPO is accepted for multi-sequence cranial MRI scans and what the out-of-pocket co-pay would be?',
        NULL, 'Billing & Insurance', 'read', NULL, NULL, NULL, DATE_SUB(NOW(), INTERVAL 1 DAY)
      ),
      (
        'Emily Watson', 'emily.w@example.com', '+1 (555) 456-7788',
        'Request for Certified Electronic Medical Records Copy',
        'I was an inpatient in the Neurology ward in June 2026. Please let me know the procedure to request certified discharge summaries and lab records.',
        2, 'Medical Records', 'replied',
        'Patient advised on how to download certified PDF records from the patient portal or visit the medical records registry on the 1st floor.',
        1, DATE_SUB(NOW(), INTERVAL 6 HOUR), DATE_SUB(NOW(), INTERVAL 2 DAY)
      ),
      (
        'Robert Chen', 'robert.c@example.com', '+1 (555) 567-8899',
        'Visiting Hours for Inpatient Intensive Care Unit',
        'What are the current visiting guidelines and permitted hours for immediate family members in the Step-Down ICU?',
        NULL, 'General Inquiry', 'archived', 'Informed visitor about 08:00 AM - 08:00 PM visiting window.',
        1, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 5 DAY)
      )
    `);
    console.log('✅ Seeded 4 representative contact inquiries across all status states.');
  }

  console.log('🎉 Contact & Inquiry Management Module Migration Completed Successfully!');
}

if (require.main === module) {
  migrateContactModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateContactModule;
