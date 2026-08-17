const db = require('../server/config/db');

async function migratePrescriptionModule() {
  console.log('🚀 Starting Prescription Management Module Database Migration...');

  // 1. Expand medicines catalog with rich clinical items
  const [existingMeds] = await db.query('SELECT COUNT(*) as count FROM medicines');
  if (existingMeds[0].count <= 8) {
    console.log('Expanding medicines catalog in MySQL with comprehensive clinical formularies...');
    await db.query(`
      INSERT INTO medicines (name, generic_name, category, form, strength, unit_price, stock_quantity, min_stock_level, manufacturer, status)
      VALUES 
      ('Augmentin', 'Amoxicillin / Clavulanic Acid', 'Antibiotic', 'tablet', '625mg', 24.50, 180, 30, 'GSK Pharmaceuticals', 'in_stock'),
      ('Crestor', 'Rosuvastatin Calcium', 'Cardiovascular', 'tablet', '20mg', 32.00, 210, 40, 'AstraZeneca', 'in_stock'),
      ('Cozaar', 'Losartan Potassium', 'Antihypertensive', 'tablet', '50mg', 16.80, 290, 50, 'Merck & Co', 'in_stock'),
      ('Norvasc', 'Amlodipine Besylate', 'Antihypertensive', 'tablet', '10mg', 14.50, 340, 50, 'Pfizer', 'in_stock'),
      ('Januvia', 'Sitagliptin', 'Antidiabetic', 'tablet', '100mg', 38.00, 120, 25, 'Merck Sharp & Dohme', 'in_stock'),
      ('Lantus Solostar', 'Insulin Glargine', 'Antidiabetic', 'injection', '100 units/mL', 65.00, 90, 20, 'Sanofi', 'in_stock'),
      ('Symbicort Turbuhaler', 'Budesonide / Formoterol', 'Respiratory', 'inhaler', '160/4.5mcg', 58.00, 75, 15, 'AstraZeneca', 'in_stock'),
      ('Voltaren Emulgel', 'Diclofenac Diethylamine', 'Analgesic / NSAID', 'topical', '1.16%', 15.20, 160, 30, 'Novartis', 'in_stock'),
      ('Ciprodex', 'Ciprofloxacin / Dexamethasone', 'Ophthalmic / Otic', 'drops', '0.3%/0.1%', 28.00, 110, 20, 'Alcon', 'in_stock'),
      ('Zithromax', 'Azithromycin', 'Antibiotic', 'tablet', '500mg', 22.00, 190, 35, 'Pfizer', 'in_stock'),
      ('Lasix', 'Furosemide', 'Diuretic', 'tablet', '40mg', 9.50, 400, 60, 'Sanofi', 'in_stock'),
      ('Xanax', 'Alprazolam', 'Anxiolytic', 'tablet', '0.5mg', 21.00, 95, 20, 'Pfizer', 'in_stock')
    `);
    console.log('✅ Added 12 new clinical medicines to hospital formulary.');
  }

  // 2. Create prescription_orders (or enhance prescriptions) table
  // Let's create prescription_items table first
  await db.query(`
    CREATE TABLE IF NOT EXISTS prescription_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      prescription_id INT NOT NULL,
      medicine_id INT NULL,
      medicine_name VARCHAR(120) NOT NULL,
      generic_name VARCHAR(120) NULL,
      dosage VARCHAR(60) NOT NULL,
      frequency VARCHAR(60) NOT NULL,
      route VARCHAR(50) DEFAULT 'Oral',
      duration VARCHAR(60) NOT NULL,
      instructions TEXT NULL,
      quantity VARCHAR(60) NULL,
      unit_price DECIMAL(10,2) DEFAULT 0.00,
      total_price DECIMAL(10,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_rx_item_pres (prescription_id),
      INDEX idx_rx_item_med (medicine_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified prescription_items table in MySQL.');

  // 3. Create prescription_orders header table
  await db.query(`
    CREATE TABLE IF NOT EXISTS prescription_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      prescription_number VARCHAR(30) NOT NULL UNIQUE,
      patient_id INT NOT NULL,
      doctor_id INT NOT NULL,
      record_id INT NULL,
      appointment_id INT NULL,
      opd_queue_id INT NULL,
      prescription_date DATE NOT NULL,
      status ENUM('draft', 'finalized', 'dispensed', 'cancelled') DEFAULT 'draft',
      diagnosis VARCHAR(255) NULL,
      doctor_notes TEXT NULL,
      patient_advice TEXT NULL,
      is_locked TINYINT(1) DEFAULT 0,
      finalized_at DATETIME NULL,
      dispensed_at DATETIME NULL,
      dispensed_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE SET NULL,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
      FOREIGN KEY (opd_queue_id) REFERENCES opd_queues(id) ON DELETE SET NULL,
      FOREIGN KEY (dispensed_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_rx_patient_date (patient_id, prescription_date DESC),
      INDEX idx_rx_doctor (doctor_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified prescription_orders table in MySQL.');

  // Add FK from prescription_items to prescription_orders if not present
  try {
    await db.query(`
      ALTER TABLE prescription_items 
      ADD CONSTRAINT fk_rx_items_order 
      FOREIGN KEY (prescription_id) REFERENCES prescription_orders(id) ON DELETE CASCADE
    `);
  } catch (_) {
    // Constraint already exists
  }

  // 4. Seed sample multi-item prescription orders
  const [existingOrders] = await db.query('SELECT id FROM prescription_orders LIMIT 1');
  if (existingOrders.length === 0) {
    console.log('Seeding initial multi-item clinical prescription orders...');

    // Order 1: Finalized post-CABG regimen for Patient 1 (Arthur)
    const [ord1] = await db.query(`
      INSERT INTO prescription_orders 
      (prescription_number, patient_id, doctor_id, record_id, prescription_date, status, diagnosis, doctor_notes, patient_advice, is_locked, finalized_at)
      VALUES 
      ('RX-2026-000101', 1, 1, 14, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'finalized', 'Stage 1 Essential Hypertension & Post-CABG', 'Patient tolerating regimen well.', 'Maintain low sodium DASH diet. Walk 30 mins daily. Return in 60 days.', 1, DATE_SUB(CURDATE(), INTERVAL 30 DAY))
    `);

    await db.query(`
      INSERT INTO prescription_items 
      (prescription_id, medicine_id, medicine_name, generic_name, dosage, frequency, route, duration, instructions, quantity, unit_price, total_price)
      VALUES 
      (?, 12, 'Norvasc', 'Amlodipine Besylate', '10mg', 'Once daily (morning)', 'Oral', '60 days', 'Take with a glass of water after breakfast', '60 Tablets', 14.50, 29.00),
      (?, 10, 'Crestor', 'Rosuvastatin Calcium', '20mg', 'Once daily (bedtime)', 'Oral', '60 days', 'Take at bedtime. Report any unexplained muscle soreness', '60 Tablets', 32.00, 64.00),
      (?, 7, 'Panadol Extra', 'Paracetamol / Caffeine', '500mg/65mg', 'As needed (PRN)', 'Oral', '14 days', 'For mild joint stiffness. Do not exceed 4 tablets/day', '24 Tablets', 6.50, 6.50)
    `, [ord1.insertId, ord1.insertId, ord1.insertId]);

    // Order 2: Finalized Migraine Management for Patient 2
    const [ord2] = await db.query(`
      INSERT INTO prescription_orders 
      (prescription_number, patient_id, doctor_id, prescription_date, status, diagnosis, doctor_notes, patient_advice, is_locked, finalized_at)
      VALUES 
      ('RX-2026-000102', 2, 2, DATE_SUB(CURDATE(), INTERVAL 7 DAY), 'finalized', 'Refractory Migraine with Aura', 'Prescribed acute abortive and daily preventive therapies.', 'Keep headache diary. Avoid dietary triggers (aged cheese, red wine).', 1, DATE_SUB(CURDATE(), INTERVAL 7 DAY))
    `);

    await db.query(`
      INSERT INTO prescription_items 
      (prescription_id, medicine_id, medicine_name, generic_name, dosage, frequency, route, duration, instructions, quantity, unit_price, total_price)
      VALUES 
      (?, 6, 'Zoloft', 'Sertraline', '50mg', 'Once daily (morning)', 'Oral', '30 days', 'Take in the morning with breakfast', '30 Tablets', 31.00, 31.00),
      (?, 16, 'Voltaren Emulgel', 'Diclofenac Diethylamine', '1.16%', 'Thrice daily (TDS)', 'Topical', '14 days', 'Apply small amount to posterior neck muscles during tension', '1 Tube', 15.20, 15.20)
    `, [ord2.insertId, ord2.insertId]);

    // Order 3: Draft prescription for today
    const [ord3] = await db.query(`
      INSERT INTO prescription_orders 
      (prescription_number, patient_id, doctor_id, prescription_date, status, diagnosis, doctor_notes, patient_advice, is_locked)
      VALUES 
      ('RX-2026-000103', 3, 1, CURDATE(), 'draft', 'Acute Upper Respiratory Tract Infection', 'Pending diagnostic confirmation.', 'Rest and hydrate. Complete antibiotic course if started.', 0)
    `);

    await db.query(`
      INSERT INTO prescription_items 
      (prescription_id, medicine_id, medicine_name, generic_name, dosage, frequency, route, duration, instructions, quantity, unit_price, total_price)
      VALUES 
      (?, 9, 'Augmentin', 'Amoxicillin / Clavulanic Acid', '625mg', 'Twice daily (BD)', 'Oral', '7 days', 'Take at start of meals to avoid stomach upset', '14 Tablets', 24.50, 24.50),
      (?, 4, 'Ventolin', 'Salbutamol', '100mcg', '2 puffs every 6 hours PRN', 'Inhalation', '14 days', 'Inhale for wheezing or chest tightness', '1 Inhaler', 22.00, 22.00)
    `, [ord3.insertId, ord3.insertId]);

    console.log('✅ Seeded 3 multi-item prescription orders with line items.');
  }

  console.log('🎉 Prescription Management Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migratePrescriptionModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migratePrescriptionModule;
