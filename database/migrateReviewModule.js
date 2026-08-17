const db = require('../server/config/db');

async function migrateReviewModule() {
  console.log('⭐ Starting Patient Reviews & Testimonials Module Database Migration...');

  // 1. Create or upgrade reviews table
  await db.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NULL,
      user_id INT NULL,
      patient_name VARCHAR(150) NOT NULL,
      patient_email VARCHAR(150) NULL,
      doctor_id INT NULL,
      department_id INT NULL,
      appointment_id INT NULL,
      rating INT NOT NULL DEFAULT 5,
      title VARCHAR(200) NULL,
      comment TEXT NOT NULL,
      status ENUM('pending', 'approved', 'rejected', 'hidden') NOT NULL DEFAULT 'approved',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      admin_notes TEXT NULL,
      approved_by INT NULL,
      approved_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
      INDEX idx_review_status (status),
      INDEX idx_review_featured (is_featured),
      INDEX idx_review_doctor (doctor_id),
      INDEX idx_review_rating (rating)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  // Ensure all columns exist if table was created in an earlier simpler state
  const [cols] = await db.query('DESCRIBE reviews');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('patient_id')) {
    await db.query('ALTER TABLE reviews ADD COLUMN patient_id INT NULL AFTER id');
  }
  if (!colNames.includes('user_id')) {
    await db.query('ALTER TABLE reviews ADD COLUMN user_id INT NULL AFTER patient_id');
  }
  if (!colNames.includes('patient_email')) {
    await db.query('ALTER TABLE reviews ADD COLUMN patient_email VARCHAR(150) NULL AFTER patient_name');
  }
  if (!colNames.includes('department_id')) {
    await db.query('ALTER TABLE reviews ADD COLUMN department_id INT NULL AFTER doctor_id');
  }
  if (!colNames.includes('appointment_id')) {
    await db.query('ALTER TABLE reviews ADD COLUMN appointment_id INT NULL AFTER department_id');
  }
  if (!colNames.includes('title')) {
    await db.query('ALTER TABLE reviews ADD COLUMN title VARCHAR(200) NULL AFTER rating');
  }
  if (!colNames.includes('status')) {
    await db.query("ALTER TABLE reviews ADD COLUMN status ENUM('pending', 'approved', 'rejected', 'hidden') NOT NULL DEFAULT 'approved'");
  }
  if (!colNames.includes('is_featured')) {
    await db.query('ALTER TABLE reviews ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0');
  }
  if (!colNames.includes('admin_notes')) {
    await db.query('ALTER TABLE reviews ADD COLUMN admin_notes TEXT NULL');
  }
  if (!colNames.includes('approved_by')) {
    await db.query('ALTER TABLE reviews ADD COLUMN approved_by INT NULL');
  }
  if (!colNames.includes('approved_at')) {
    await db.query('ALTER TABLE reviews ADD COLUMN approved_at DATETIME NULL');
  }

  // 2. Re-seed rich, verified patient reviews
  const [countRows] = await db.query('SELECT COUNT(*) as count FROM reviews');
  if (countRows[0].count <= 3) {
    await db.query('DELETE FROM reviews');

    await db.query(`
      INSERT INTO reviews 
      (patient_id, user_id, patient_name, patient_email, doctor_id, department_id, appointment_id, rating, title, comment, status, is_featured, approved_at, created_at)
      VALUES 
      (
        1, 10, 'Arthur Pendleton', 'arthur.pendleton@example.com', 1, 1, 1, 5,
        'Life-Saving Cardiology Care & Precision Diagnostics',
        'Dr. Marcus Vance and the Cardiology team treated my acute angina with remarkable precision. The digital telemetry and fast-track lab results gave my family immense peace of mind.',
        'approved', 1, NOW(), DATE_SUB(NOW(), INTERVAL 2 DAY)
      ),
      (
        2, 11, 'Eleanor Vance', 'eleanor.vance@example.com', 2, 2, 2, 5,
        'Cured My Chronic Vertigo After 2 Years of Suffering',
        'Dr. Elena Rostova is brilliant. She identified my atypical vestibular migraine immediately and prescribed an individualized treatment plan that changed my quality of life completely.',
        'approved', 1, NOW(), DATE_SUB(NOW(), INTERVAL 4 DAY)
      ),
      (
        3, 12, 'Michael Chang', 'michael.chang@example.com', 1, 1, NULL, 5,
        'World-Class Hospital Cleanliness & Gentle Nursing Staff',
        'From reception check-in to pharmacy collection, AuraCare sets the benchmark for modern clinical healthcare. The inpatient ward suites are spotless and comfortable.',
        'approved', 1, NOW(), DATE_SUB(NOW(), INTERVAL 6 DAY)
      ),
      (
        4, 13, 'Sarah Thompson', 'sarah.t@example.com', 2, 2, NULL, 4,
        'Very Thorough Neurological Workup',
        'Extensive MRI analysis and friendly EEG technicians. Wait time was brief and the digital patient portal allowed me to view my lab results the same afternoon.',
        'approved', 0, NOW(), DATE_SUB(NOW(), INTERVAL 8 DAY)
      ),
      (
        5, 14, 'David Miller', 'david.m@example.com', 1, 1, NULL, 5,
        'Outstanding Preventative Health Consultation',
        'Routine CAC coronary scan and biomarker screening went smoothly. Dr. Vance took the time to explain my metabolic markers in plain English.',
        'approved', 0, NOW(), DATE_SUB(NOW(), INTERVAL 10 DAY)
      )
    `);
    console.log('✅ Seeded 5 verified patient testimonials with ratings and links.');
  }

  console.log('🎉 Patient Reviews & Testimonials Module Migration Completed Successfully!');
}

if (require.main === module) {
  migrateReviewModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateReviewModule;
