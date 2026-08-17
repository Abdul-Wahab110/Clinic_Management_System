const db = require('../server/config/db');

async function addMpaTables() {
  console.log('[MPA SCHEMA] Checking and creating additional hospital tables...');

  // 17. MEDICINES TABLE
  await db.query(`
    CREATE TABLE IF NOT EXISTS medicines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      generic_name VARCHAR(150),
      category VARCHAR(80) NOT NULL,
      form ENUM('tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops', 'inhaler') DEFAULT 'tablet',
      strength VARCHAR(50),
      unit_price DECIMAL(10,2) NOT NULL DEFAULT 5.00,
      stock_quantity INT NOT NULL DEFAULT 100,
      min_stock_level INT NOT NULL DEFAULT 20,
      manufacturer VARCHAR(120),
      expiry_date DATE NOT NULL,
      status ENUM('in_stock', 'low_stock', 'out_of_stock', 'expired') DEFAULT 'in_stock',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 18. LAB TESTS TABLE
  await db.query(`
    CREATE TABLE IF NOT EXISTS lab_tests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      code VARCHAR(30) NOT NULL UNIQUE,
      category VARCHAR(80) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 40.00,
      turnaround_hours INT DEFAULT 24,
      normal_range VARCHAR(100),
      unit VARCHAR(30),
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 19. LAB ORDERS TABLE
  await db.query(`
    CREATE TABLE IF NOT EXISTS lab_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_number VARCHAR(30) NOT NULL UNIQUE,
      patient_id INT NOT NULL,
      doctor_id INT NOT NULL,
      test_id INT NOT NULL,
      order_date DATE NOT NULL,
      sample_type VARCHAR(60),
      sample_collected_at DATETIME NULL,
      result_value VARCHAR(100) NULL,
      result_notes TEXT NULL,
      status ENUM('ordered', 'sample_collected', 'in_progress', 'completed', 'cancelled') DEFAULT 'ordered',
      completed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      FOREIGN KEY (test_id) REFERENCES lab_tests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 20. WARDS & ROOMS TABLE
  await db.query(`
    CREATE TABLE IF NOT EXISTS wards (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type ENUM('general', 'icu', 'ccu', 'pediatric', 'maternity', 'emergency', 'private_suite') NOT NULL,
      floor_number INT NOT NULL DEFAULT 1,
      total_beds INT NOT NULL DEFAULT 10,
      occupied_beds INT NOT NULL DEFAULT 0,
      price_per_day DECIMAL(10,2) NOT NULL DEFAULT 150.00,
      status ENUM('available', 'full', 'maintenance') DEFAULT 'available',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 21. VITALS TABLE
  await db.query(`
    CREATE TABLE IF NOT EXISTS vitals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      nurse_id INT NULL,
      systolic INT,
      diastolic INT,
      heart_rate INT,
      temperature DECIMAL(4,1),
      respiratory_rate INT,
      oxygen_saturation INT,
      blood_sugar INT,
      weight_kg DECIMAL(5,2),
      height_cm DECIMAL(5,2),
      notes TEXT,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 22. NOTIFICATIONS TABLE
  await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      message TEXT NOT NULL,
      type ENUM('info', 'success', 'warning', 'danger', 'appointment', 'billing', 'clinical') DEFAULT 'info',
      link VARCHAR(255) NULL,
      is_read TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 23. CONTACT MESSAGES TABLE
  await db.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(30),
      subject VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      status ENUM('new', 'read', 'replied', 'archived') DEFAULT 'new',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 24. REVIEWS & TESTIMONIALS TABLE
  await db.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_name VARCHAR(120) NOT NULL,
      doctor_id INT NULL,
      rating INT NOT NULL DEFAULT 5,
      comment TEXT NOT NULL,
      is_approved TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 25. BLOG POSTS TABLE
  await db.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      summary TEXT,
      content LONGTEXT NOT NULL,
      author VARCHAR(100) DEFAULT 'Dr. Sarah Jenkins',
      category VARCHAR(60) DEFAULT 'Cardiology',
      image_url VARCHAR(255),
      published_at DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // 26. PATIENT DOCUMENTS TABLE
  await db.query(`
    CREATE TABLE IF NOT EXISTS patient_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      document_name VARCHAR(200) NOT NULL,
      document_type VARCHAR(60) NOT NULL,
      file_path VARCHAR(255),
      uploaded_by INT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Seed sample medicines if empty
  const [medCount] = await db.query('SELECT COUNT(*) as count FROM medicines');
  if (medCount[0].count === 0) {
    await db.query(`
      INSERT INTO medicines (name, generic_name, category, form, strength, unit_price, stock_quantity, min_stock_level, manufacturer, expiry_date, status) VALUES
      ('Lipitor', 'Atorvastatin', 'Cardiovascular', 'tablet', '20mg', 18.50, 240, 30, 'Pfizer Labs', '2027-12-31', 'in_stock'),
      ('Amoxil', 'Amoxicillin', 'Antibiotics', 'capsule', '500mg', 12.00, 150, 40, 'GlaxoSmithKline', '2027-08-15', 'in_stock'),
      ('Glucophage', 'Metformin', 'Endocrinology', 'tablet', '850mg', 14.25, 320, 50, 'Merck Santé', '2028-02-28', 'in_stock'),
      ('Ventolin', 'Salbutamol', 'Respiratory', 'inhaler', '100mcg', 22.00, 85, 20, 'GSK Pharma', '2027-11-30', 'in_stock'),
      ('Nexium', 'Esomeprazole', 'Gastroenterology', 'capsule', '40mg', 26.50, 110, 25, 'AstraZeneca', '2027-10-20', 'in_stock'),
      ('Zoloft', 'Sertraline', 'Psychiatry', 'tablet', '50mg', 31.00, 75, 20, 'Pfizer Labs', '2028-05-15', 'in_stock'),
      ('Panadol Extra', 'Paracetamol / Caffeine', 'Analgesics', 'tablet', '500mg/65mg', 6.50, 500, 100, 'Haleon', '2028-09-30', 'in_stock'),
      ('Rocephin', 'Ceftriaxone', 'Antibiotics', 'injection', '1g', 45.00, 40, 15, 'Roche', '2027-06-30', 'in_stock')
    `);
  }

  // Seed sample lab tests if empty
  const [labTestCount] = await db.query('SELECT COUNT(*) as count FROM lab_tests');
  if (labTestCount[0].count === 0) {
    await db.query(`
      INSERT INTO lab_tests (name, code, category, description, price, turnaround_hours, normal_range, unit) VALUES
      ('Complete Blood Count (CBC)', 'CBC-01', 'Hematology', 'Measures RBC, WBC, platelets, hemoglobin, and hematocrit', 35.00, 6, '4.5 - 11.0', '10^3/uL'),
      ('Comprehensive Metabolic Panel (CMP)', 'CMP-02', 'Biochemistry', 'Evaluates kidney function, liver function, and electrolytes', 55.00, 12, '70 - 99', 'mg/dL'),
      ('Lipid Panel', 'LIP-03', 'Cardiology', 'Cholesterol, HDL, LDL, and Triglycerides breakdown', 45.00, 8, '< 200', 'mg/dL'),
      ('HbA1c Glycated Hemoglobin', 'A1C-04', 'Endocrinology', 'Average blood sugar level over the past 3 months', 40.00, 12, '< 5.7', '%'),
      ('Thyroid Stimulating Hormone (TSH)', 'TSH-05', 'Endocrinology', 'Screening test for thyroid disorders', 50.00, 24, '0.4 - 4.0', 'mIU/L'),
      ('Chest X-Ray Digital 2-View', 'RAD-CXR', 'Radiology', 'PA and lateral chest radiograph with radiologist report', 90.00, 4, 'Clear lung fields', 'imaging'),
      ('Brain MRI with Contrast', 'RAD-MRI', 'Radiology', 'High-resolution magnetic resonance neuroimaging', 450.00, 24, 'Unremarkable', 'imaging'),
      ('ECG / 12-Lead Electrocardiogram', 'ECG-12', 'Cardiology', 'Resting electrical heart rhythm recording', 60.00, 2, 'Normal Sinus Rhythm', 'rhythm')
    `);
  }

  // Seed sample wards if empty
  const [wardCount] = await db.query('SELECT COUNT(*) as count FROM wards');
  if (wardCount[0].count === 0) {
    await db.query(`
      INSERT INTO wards (name, type, floor_number, total_beds, occupied_beds, price_per_day, status) VALUES
      ('St. Jude Critical Care ICU', 'icu', 2, 8, 5, 650.00, 'available'),
      ('Cardiology Recovery Ward (West)', 'general', 3, 16, 9, 220.00, 'available'),
      ('Pediatric Care Pavilion', 'pediatric', 4, 12, 4, 180.00, 'available'),
      ('Maternity & Neonatal Suite', 'maternity', 4, 10, 6, 320.00, 'available'),
      ('Executive Private Medical Suites', 'private_suite', 5, 6, 2, 850.00, 'available'),
      ('Trauma & Acute Emergency Triage', 'emergency', 1, 14, 8, 400.00, 'available')
    `);
  }

  // Seed blog posts if empty
  const [blogCount] = await db.query('SELECT COUNT(*) as count FROM blog_posts');
  if (blogCount[0].count === 0) {
    await db.query(`
      INSERT INTO blog_posts (title, slug, summary, content, author, category, published_at) VALUES
      ('Early Detection of Cardiovascular Disease: What Every Adult Should Know', 'early-detection-cardiovascular-disease', 'Understanding lipid profiles, coronary artery calcium scoring, and blood pressure guidelines.', 'Cardiovascular diseases remain the leading cause of mortality worldwide. However, modern preventative cardiology now allows early detection years before clinical symptoms manifest through advanced biomarker testing and CT coronary calcium scans.', 'Dr. Marcus Vance', 'Cardiology', '2026-08-01'),
      ('Navigating Migraines and Neurological Headaches with Modern Therapies', 'navigating-migraines-neurological-headaches', 'A clinical guide to CGRP inhibitors, lifestyle triggers, and neurological diagnostics.', 'Chronic migraines impact millions of individuals daily. Recent breakthroughs in targeted monoclonal antibodies and neuromodulation offer hope for refractory cases that do not respond to conventional analgesics.', 'Dr. Elena Rostova', 'Neurology', '2026-08-05'),
      ('Comprehensive Wellness: The Role of Routine Annual Health Screenings', 'routine-annual-health-screenings', 'Why regular preventive laboratory workups save lives and identify chronic disease early.', 'Routine blood panels, diabetes screenings, and blood pressure monitoring empower physicians to intervene with lifestyle and pharmacological therapies before permanent organ damage occurs.', 'Dr. Sarah Jenkins', 'General Medicine', '2026-08-10')
    `);
  }

  // Seed patient documents and reviews if empty
  const [revCount] = await db.query('SELECT COUNT(*) as count FROM reviews');
  if (revCount[0].count === 0) {
    await db.query(`
      INSERT INTO reviews (patient_name, doctor_id, rating, comment, is_approved) VALUES
      ('Eleanor Vance', 1, 5, 'Dr. Marcus Vance was incredibly thorough during my cardiology consultation. The staff and digital check-in were seamless!', 1),
      ('Michael Chang', 2, 5, 'Dr. Rostova diagnosed my chronic vertigo accurately after months of searching. Truly exceptional care.', 1),
      ('Sarah Thompson', 1, 5, 'The hospital environment is spotless, the laboratory returned my CBC results within 3 hours, and the nurses were so gentle.', 1)
    `);
  }

  console.log('✅ [MPA SCHEMA] All additional hospital tables and initial seeds created successfully!');
}

if (require.main === module) {
  addMpaTables().then(() => process.exit(0)).catch(err => {
    console.error('[MPA SCHEMA ERROR]', err);
    process.exit(1);
  });
}

module.exports = addMpaTables;
