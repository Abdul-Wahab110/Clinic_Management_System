const db = require('../server/config/db');

async function migrateLabModule() {
  console.log('🔬 Starting Laboratory Management Module Database Migration...');

  // 1. Create lab_categories table
  await db.query(`
    CREATE TABLE IF NOT EXISTS lab_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      code VARCHAR(30) NOT NULL UNIQUE,
      description TEXT NULL,
      icon VARCHAR(50) DEFAULT 'fa-flask',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified lab_categories table.');

  // Seed default lab categories
  const [existingCats] = await db.query('SELECT COUNT(*) as count FROM lab_categories');
  if (existingCats[0].count === 0) {
    await db.query(`
      INSERT INTO lab_categories (name, code, description, icon) VALUES
      ('Hematology', 'HEM', 'Complete blood cell counts, coagulation profiling, and blood smear diagnostics', 'fa-droplet'),
      ('Clinical Biochemistry', 'BIO', 'Metabolic panels, liver/kidney function, cardiac enzymes, and electrolytes', 'fa-vial'),
      ('Microbiology & Parasitology', 'MIC', 'Bacterial cultures, sensitivity testing, fungal and parasite examinations', 'fa-bacterium'),
      ('Immunology & Serology', 'IMM', 'Viral antibodies, autoimmune markers, antigen detection, and allergy assays', 'fa-shield-virus'),
      ('Endocrinology & Hormones', 'END', 'Thyroid panels, reproductive hormones, insulin, cortisol, and vitamin levels', 'fa-dna'),
      ('Pathology & Histology', 'PAT', 'Biopsies, cytology, PAP smears, and cellular tissue pathology', 'fa-microscope'),
      ('Cardiology Diagnostics', 'CAR', '12-Lead ECG, Holter monitoring, Troponin biomarkers, and echocardiogram', 'fa-heart-pulse'),
      ('Radiology & Imaging', 'RAD', 'Digital X-Rays, Ultrasound sonography, Computed Tomography, and MRI', 'fa-x-ray')
    `);
    console.log('✅ Seeded 8 standard clinical laboratory categories.');
  }

  // 2. Enhance lab_tests table
  try {
    await db.query(`ALTER TABLE lab_tests ADD COLUMN category_id INT NULL AFTER id`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_tests ADD COLUMN sample_type VARCHAR(80) DEFAULT 'Venous Blood' AFTER category`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_tests ADD COLUMN fasting_required TINYINT(1) DEFAULT 0 AFTER description`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_tests ADD COLUMN default_parameters LONGTEXT NULL AFTER fasting_required`);
  } catch (_) {}

  // Update existing lab tests with category_id and default parameter templates
  const [hemaCat] = await db.query("SELECT id FROM lab_categories WHERE code = 'HEM' LIMIT 1");
  const [bioCat] = await db.query("SELECT id FROM lab_categories WHERE code = 'BIO' LIMIT 1");
  const [carCat] = await db.query("SELECT id FROM lab_categories WHERE code = 'CAR' LIMIT 1");
  const [endCat] = await db.query("SELECT id FROM lab_categories WHERE code = 'END' LIMIT 1");
  const [immCat] = await db.query("SELECT id FROM lab_categories WHERE code = 'IMM' LIMIT 1");

  const cbcParams = JSON.stringify([
    { name: 'Hemoglobin (Hb)', unit: 'g/dL', ref_range: '13.5 - 17.5' },
    { name: 'Total Leukocyte Count (WBC)', unit: 'x10^3/uL', ref_range: '4.5 - 11.0' },
    { name: 'Red Blood Cell Count (RBC)', unit: 'x10^6/uL', ref_range: '4.3 - 5.9' },
    { name: 'Hematocrit (PCV)', unit: '%', ref_range: '38.8 - 50.0' },
    { name: 'Platelet Count', unit: 'x10^3/uL', ref_range: '150 - 450' },
    { name: 'Mean Corpuscular Volume (MCV)', unit: 'fL', ref_range: '80.0 - 96.0' }
  ]);

  const lipidParams = JSON.stringify([
    { name: 'Total Cholesterol', unit: 'mg/dL', ref_range: '< 200' },
    { name: 'Triglycerides', unit: 'mg/dL', ref_range: '< 150' },
    { name: 'HDL Cholesterol (Good)', unit: 'mg/dL', ref_range: '> 40' },
    { name: 'LDL Cholesterol (Calculated)', unit: 'mg/dL', ref_range: '< 100' },
    { name: 'VLDL Cholesterol', unit: 'mg/dL', ref_range: '5 - 40' },
    { name: 'Cholesterol / HDL Ratio', unit: 'ratio', ref_range: '< 4.5' }
  ]);

  const bmpParams = JSON.stringify([
    { name: 'Fasting Blood Glucose', unit: 'mg/dL', ref_range: '70 - 99' },
    { name: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dL', ref_range: '7 - 20' },
    { name: 'Serum Creatinine', unit: 'mg/dL', ref_range: '0.7 - 1.3' },
    { name: 'eGFR (Calculated)', unit: 'mL/min/1.73m²', ref_range: '> 90' },
    { name: 'Serum Sodium (Na+)', unit: 'mEq/L', ref_range: '136 - 145' },
    { name: 'Serum Potassium (K+)', unit: 'mEq/L', ref_range: '3.5 - 5.1' },
    { name: 'Serum Chloride (Cl-)', unit: 'mEq/L', ref_range: '96 - 106' },
    { name: 'Serum Calcium (Ca2+)', unit: 'mg/dL', ref_range: '8.5 - 10.2' }
  ]);

  const lftParams = JSON.stringify([
    { name: 'Total Bilirubin', unit: 'mg/dL', ref_range: '0.1 - 1.2' },
    { name: 'Direct (Conjugated) Bilirubin', unit: 'mg/dL', ref_range: '0.0 - 0.3' },
    { name: 'SGPT / ALT', unit: 'U/L', ref_range: '7 - 56' },
    { name: 'SGOT / AST', unit: 'U/L', ref_range: '10 - 40' },
    { name: 'Alkaline Phosphatase (ALP)', unit: 'U/L', ref_range: '44 - 147' },
    { name: 'Total Serum Protein', unit: 'g/dL', ref_range: '6.0 - 8.3' },
    { name: 'Serum Albumin', unit: 'g/dL', ref_range: '3.5 - 5.0' }
  ]);

  const thyroidParams = JSON.stringify([
    { name: 'Thyroid Stimulating Hormone (TSH)', unit: 'uIU/mL', ref_range: '0.45 - 4.50' },
    { name: 'Free Thyroxine (FT4)', unit: 'ng/dL', ref_range: '0.82 - 1.77' },
    { name: 'Free Triiodothyronine (FT3)', unit: 'pg/mL', ref_range: '2.0 - 4.4' }
  ]);

  // Insert or update core catalog tests
  await db.query(`
    INSERT INTO lab_tests (category_id, name, code, category, sample_type, price, turnaround_hours, description, fasting_required, default_parameters, is_active)
    VALUES 
    (${hemaCat[0]?.id || 1}, 'Complete Blood Count (CBC with Diff)', 'CBC-01', 'Hematology', 'Whole Blood (EDTA)', 35.00, 4, 'Full cellular profile evaluating red cells, white cells, hemoglobin, and platelets', 0, '${cbcParams}', 1),
    (${bioCat[0]?.id || 2}, 'Lipid Profile Panel', 'LIPID-02', 'Biochemistry', 'Serum (SST)', 45.00, 6, 'Total cholesterol, HDL, LDL, VLDL, and triglycerides risk assessment', 1, '${lipidParams}', 1),
    (${bioCat[0]?.id || 2}, 'Basic Metabolic Panel (BMP)', 'BMP-03', 'Biochemistry', 'Serum (SST)', 40.00, 4, 'Kidney function, electrolytes, blood sugar, and acid/base balance', 1, '${bmpParams}', 1),
    (${bioCat[0]?.id || 2}, 'Liver Function Test (LFT)', 'LFT-05', 'Biochemistry', 'Serum (SST)', 55.00, 6, 'Hepatic enzymes, bilirubin, albumin, and protein synthesis capacity', 1, '${lftParams}', 1),
    (${endCat[0]?.id || 5}, 'Comprehensive Thyroid Panel', 'THYROID-07', 'Endocrinology', 'Serum (SST)', 65.00, 12, 'TSH, Free T3, and Free T4 thyroid metabolic evaluation', 0, '${thyroidParams}', 1),
    (${carCat[0]?.id || 7}, 'High-Sensitivity Troponin-I (hs-cTnI)', 'TROP-09', 'Cardiology Diagnostics', 'Plasma (Heparin)', 50.00, 2, 'Myocardial injury and acute coronary syndrome cardiac biomarker', 0, NULL, 1)
    ON DUPLICATE KEY UPDATE 
    category_id = VALUES(category_id),
    default_parameters = VALUES(default_parameters),
    fasting_required = VALUES(fasting_required)
  `);
  console.log('✅ Enhanced lab_tests formulary and parameter templates.');

  // 3. Enhance lab_orders table
  try {
    await db.query(`ALTER TABLE lab_orders ADD COLUMN record_id INT NULL AFTER doctor_id`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_orders ADD COLUMN appointment_id INT NULL AFTER record_id`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_orders ADD COLUMN opd_queue_id INT NULL AFTER appointment_id`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_orders ADD COLUMN priority ENUM('routine', 'urgent', 'stat') DEFAULT 'routine' AFTER order_date`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_orders ADD COLUMN clinical_notes TEXT NULL AFTER priority`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_orders ADD COLUMN sample_collected_by INT NULL AFTER sample_collected_at`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_orders ADD COLUMN processing_started_at DATETIME NULL AFTER sample_collected_by`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_orders ADD COLUMN completed_by INT NULL AFTER completed_at`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_orders ADD COLUMN verified_at DATETIME NULL AFTER completed_by`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_orders ADD COLUMN verified_by INT NULL AFTER verified_at`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_orders ADD COLUMN total_price DECIMAL(10,2) DEFAULT 0.00 AFTER verified_by`);
  } catch (_) {}
  try {
    await db.query(`ALTER TABLE lab_orders MODIFY COLUMN status ENUM('ordered', 'sample_collected', 'processing', 'completed', 'verified', 'cancelled') DEFAULT 'ordered'`);
  } catch (_) {}
  console.log('✅ Enhanced lab_orders workflow fields.');

  // 4. Create lab_order_items table
  await db.query(`
    CREATE TABLE IF NOT EXISTS lab_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      test_id INT NOT NULL,
      test_name VARCHAR(150) NOT NULL,
      category_name VARCHAR(100) NULL,
      sample_type VARCHAR(80) NULL,
      price DECIMAL(10,2) DEFAULT 0.00,
      status ENUM('ordered', 'sample_collected', 'processing', 'completed', 'verified', 'cancelled') DEFAULT 'ordered',
      comments TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_loi_order (order_id),
      INDEX idx_loi_test (test_id),
      FOREIGN KEY (order_id) REFERENCES lab_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (test_id) REFERENCES lab_tests(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified lab_order_items table.');

  // 5. Create lab_results table
  await db.query(`
    CREATE TABLE IF NOT EXISTS lab_results (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      order_item_id INT NULL,
      parameter_name VARCHAR(120) NOT NULL,
      result_value VARCHAR(120) NOT NULL,
      unit VARCHAR(50) NULL,
      reference_range VARCHAR(100) NULL,
      flag ENUM('normal', 'high', 'low', 'critical', 'abnormal') DEFAULT 'normal',
      comments TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_lr_order (order_id),
      INDEX idx_lr_item (order_item_id),
      FOREIGN KEY (order_id) REFERENCES lab_orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified lab_results table.');

  // 6. Seed sample multi-parameter results for existing lab orders (Order 1 & 2)
  const [existingResults] = await db.query('SELECT id FROM lab_results LIMIT 1');
  if (existingResults.length === 0) {
    console.log('Seeding rich multi-parameter structured test results for Order 1 & Order 2...');

    // Make sure lab_order_items exist for order 1 & 2
    const [loi1] = await db.query(`
      INSERT INTO lab_order_items (order_id, test_id, test_name, category_name, sample_type, price, status)
      VALUES (1, 1, 'Complete Blood Count (CBC with Diff)', 'Hematology', 'Whole Blood (EDTA)', 35.00, 'verified')
    `);
    const loi1Id = loi1.insertId;

    await db.query(`
      INSERT INTO lab_results (order_id, order_item_id, parameter_name, result_value, unit, reference_range, flag, comments)
      VALUES
      (1, ${loi1Id}, 'Hemoglobin (Hb)', '15.2', 'g/dL', '13.5 - 17.5', 'normal', 'Optimal oxygen carrying capacity'),
      (1, ${loi1Id}, 'Total Leukocyte Count (WBC)', '6.8', 'x10^3/uL', '4.5 - 11.0', 'normal', 'No active leukocytosis'),
      (1, ${loi1Id}, 'Red Blood Cell Count (RBC)', '4.9', 'x10^6/uL', '4.3 - 5.9', 'normal', 'Normocytic, normochromic'),
      (1, ${loi1Id}, 'Hematocrit (PCV)', '44.5', '%', '38.8 - 50.0', 'normal', 'Within target range'),
      (1, ${loi1Id}, 'Platelet Count', '245', 'x10^3/uL', '150 - 450', 'normal', 'Adequate hemostatic reserve'),
      (1, ${loi1Id}, 'Mean Corpuscular Volume (MCV)', '89.2', 'fL', '80.0 - 96.0', 'normal', 'Normal erythrocyte volume')
    `);

    const [loi2] = await db.query(`
      INSERT INTO lab_order_items (order_id, test_id, test_name, category_name, sample_type, price, status)
      VALUES (2, 3, 'Lipid Profile Panel', 'Biochemistry', 'Serum (SST)', 45.00, 'verified')
    `);
    const loi2Id = loi2.insertId;

    await db.query(`
      INSERT INTO lab_results (order_id, order_item_id, parameter_name, result_value, unit, reference_range, flag, comments)
      VALUES
      (2, ${loi2Id}, 'Total Cholesterol', '168', 'mg/dL', '< 200', 'normal', 'Desirable lipid level'),
      (2, ${loi2Id}, 'Triglycerides', '140', 'mg/dL', '< 150', 'normal', 'Normal fasting triglycerides'),
      (2, ${loi2Id}, 'HDL Cholesterol (Good)', '52', 'mg/dL', '> 40', 'normal', 'Adequate cardioprotective HDL'),
      (2, ${loi2Id}, 'LDL Cholesterol (Calculated)', '88', 'mg/dL', '< 100', 'normal', 'Atorvastatin 20mg target achieved'),
      (2, ${loi2Id}, 'Cholesterol / HDL Ratio', '3.2', 'ratio', '< 4.5', 'normal', 'Low atherogenic risk index')
    `);

    // Update order 1 and 2 status to verified
    await db.query(`
      UPDATE lab_orders 
      SET status = 'verified', 
          verified_at = '2026-08-10 17:00:00', 
          sample_collected_at = '2026-08-10 10:00:00',
          processing_started_at = '2026-08-10 11:00:00'
      WHERE id IN (1, 2)
    `);

    console.log('✅ Seeded 11 multi-parameter verified test results with reference ranges.');
  }

  console.log('🎉 Laboratory Management Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migrateLabModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateLabModule;
