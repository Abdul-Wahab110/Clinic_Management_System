const db = require('../server/config/db');

async function migrateBillingModule() {
  console.log('💳 Starting Billing & Invoice Management Module Database Migration...');

  // 1. Create billing_services table
  await db.query(`
    CREATE TABLE IF NOT EXISTS billing_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      service_code VARCHAR(40) NOT NULL UNIQUE,
      service_name VARCHAR(150) NOT NULL,
      service_type ENUM('consultation', 'laboratory', 'radiology', 'pharmacy', 'room_charge', 'procedure', 'general_service') NOT NULL,
      department_id INT NULL,
      standard_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      tax_rate_percent DECIMAL(5,2) NOT NULL DEFAULT 5.00,
      description TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
      INDEX idx_bs_type (service_type),
      INDEX idx_bs_code (service_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified billing_services table in MySQL.');

  // Seed default billing services
  const [existingServices] = await db.query('SELECT COUNT(*) as count FROM billing_services');
  if (existingServices[0].count === 0) {
    await db.query(`
      INSERT INTO billing_services 
      (service_code, service_name, service_type, department_id, standard_price, tax_rate_percent, description)
      VALUES
      ('SRV-CON-001', 'Specialist Physician Outpatient Consultation', 'consultation', 1, 150.00, 5.00, 'Comprehensive specialist physician clinical examination and consultation'),
      ('SRV-CON-002', 'Emergency Department Acute Triage & Examination', 'consultation', 12, 120.00, 5.00, 'Immediate emergency trauma/critical triage physician evaluation'),
      ('SRV-LAB-001', 'Complete Blood Count (CBC with Automated 5-Part Diff)', 'laboratory', 11, 35.00, 5.00, 'Analytical hematology complete blood panel with differential'),
      ('SRV-LAB-002', 'Comprehensive Metabolic & Lipid Cardiovascular Panel', 'laboratory', 11, 65.00, 5.00, 'Electrolytes, BUN, Creatinine, Total Cholesterol, HDL, LDL, Triglycerides'),
      ('SRV-RAD-001', 'Chest Radiograph Digital X-Ray (PA & Lateral Views)', 'radiology', 10, 85.00, 5.00, 'Dual-view digital chest radiograph with radiologist diagnostic impression'),
      ('SRV-RAD-002', 'Transthoracic Echocardiogram with Doppler Flow', 'radiology', 1, 350.00, 5.00, 'Full structural cardiac ultrasound with ejection fraction assessment'),
      ('SRV-RAD-003', 'Non-Contrast Computed Tomography (CT) Brain / Head', 'radiology', 10, 420.00, 5.00, 'High-resolution multi-slice axial brain CT scan'),
      ('SRV-PHARM-001', 'Inpatient Dispensary Prescription Compound', 'pharmacy', 1, 45.00, 5.00, 'Dispensed pharmaceutical compound and clinical medication administration'),
      ('SRV-ROOM-001', 'Intensive Care Unit (ICU) Room Stay (Per 24h Day)', 'room_charge', 1, 450.00, 5.00, '24-hour critical care bed with continuous multi-parameter telemetry'),
      ('SRV-ROOM-002', 'Coronary Care Unit (CCU) Monitored Room Stay (Per 24h)', 'room_charge', 1, 400.00, 5.00, 'Continuous 12-lead ECG cardiac monitoring inpatient bed'),
      ('SRV-ROOM-003', 'Standard Semi-Private Inpatient Ward Stay (Per 24h)', 'room_charge', 2, 150.00, 5.00, 'General medical-surgical ward accommodation with nursing care'),
      ('SRV-PROC-001', 'Sterile Minor Surgical Wound Debridement & Suturing', 'procedure', 5, 180.00, 5.00, 'Local anesthetic wound exploration, debridement, and precision closure'),
      ('SRV-PROC-002', 'Standard Electrocardiogram (ECG 12-Lead Diagnostic)', 'procedure', 1, 55.00, 5.00, 'Resting 12-lead electrocardiogram tracing and physician interpretation'),
      ('SRV-GEN-001', 'Hospital Emergency Nursing & Infusion Care Fee', 'general_service', 12, 40.00, 5.00, 'Nursing assessment, IV line placement, and clinical monitoring')
    `);
    console.log('✅ Seeded 14 configurable hospital billing services across all modalities.');
  }

  // 2. Enhance invoices table
  const [invCols] = await db.query('DESCRIBE invoices');
  const invColNames = invCols.map(c => c.Field);

  if (!invColNames.includes('invoice_date')) {
    await db.query('ALTER TABLE invoices ADD COLUMN invoice_date DATE NOT NULL DEFAULT (CURRENT_DATE)');
  }
  if (!invColNames.includes('admission_id')) {
    await db.query('ALTER TABLE invoices ADD COLUMN admission_id INT NULL');
  }
  if (!invColNames.includes('doctor_id')) {
    await db.query('ALTER TABLE invoices ADD COLUMN doctor_id INT NULL');
  }
  if (!invColNames.includes('department_id')) {
    await db.query('ALTER TABLE invoices ADD COLUMN department_id INT NULL');
  }
  if (!invColNames.includes('subtotal')) {
    await db.query('ALTER TABLE invoices ADD COLUMN subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00');
  }
  if (!invColNames.includes('discount_type')) {
    await db.query("ALTER TABLE invoices ADD COLUMN discount_type ENUM('percentage', 'fixed') DEFAULT 'fixed'");
  }
  if (!invColNames.includes('discount_rate')) {
    await db.query('ALTER TABLE invoices ADD COLUMN discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00');
  }
  if (!invColNames.includes('tax_rate')) {
    await db.query('ALTER TABLE invoices ADD COLUMN tax_rate DECIMAL(5,2) NOT NULL DEFAULT 5.00');
  }
  if (!invColNames.includes('paid_amount')) {
    await db.query('ALTER TABLE invoices ADD COLUMN paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00');
  }
  if (!invColNames.includes('remaining_amount')) {
    await db.query('ALTER TABLE invoices ADD COLUMN remaining_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00');
  }
  if (!invColNames.includes('billing_notes')) {
    await db.query('ALTER TABLE invoices ADD COLUMN billing_notes TEXT NULL');
  }
  if (!invColNames.includes('created_by')) {
    await db.query('ALTER TABLE invoices ADD COLUMN created_by INT NOT NULL DEFAULT 1');
  }

  console.log('✅ Enhanced invoices schema with comprehensive financial fields.');

  // 3. Create invoice_items table
  await db.query(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      service_type ENUM('consultation', 'laboratory', 'radiology', 'pharmacy', 'room_charge', 'procedure', 'general_service') NOT NULL,
      item_reference_id INT NULL,
      item_name VARCHAR(200) NOT NULL,
      item_description VARCHAR(255) NULL,
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      INDEX idx_inv_item (invoice_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified invoice_items table in MySQL.');

  // 4. Enhance payments table
  const [payCols] = await db.query('DESCRIBE payments');
  const payColNames = payCols.map(c => c.Field);

  if (!payColNames.includes('receipt_number')) {
    await db.query('ALTER TABLE payments ADD COLUMN receipt_number VARCHAR(40) NULL');
  }
  if (!payColNames.includes('patient_id')) {
    await db.query('ALTER TABLE payments ADD COLUMN patient_id INT NOT NULL DEFAULT 1');
  }
  if (!payColNames.includes('received_by')) {
    await db.query('ALTER TABLE payments ADD COLUMN received_by INT NOT NULL DEFAULT 1');
  }
  if (!payColNames.includes('status')) {
    await db.query("ALTER TABLE payments ADD COLUMN status ENUM('completed', 'reversed', 'refunded') DEFAULT 'completed'");
  }

  // Update existing payments with receipt numbers if empty
  await db.query(`
    UPDATE payments SET 
      receipt_number = CONCAT('REC-2026-', LPAD(id, 6, '0'))
    WHERE receipt_number IS NULL OR receipt_number = ''
  `);

  console.log('✅ Enhanced payments schema with receipt numbers and cashier tracking.');

  // 5. Seed initial multi-item comprehensive invoice if none exists
  const [existingInv] = await db.query('SELECT COUNT(*) as count FROM invoices');
  if (existingInv[0].count === 0) {
    const invNumber = 'INV-2026-000101';
    const [invRes] = await db.query(`
      INSERT INTO invoices 
      (invoice_number, patient_id, appointment_id, doctor_id, department_id, subtotal, discount_type, discount_rate, discount_amount, tax_rate, tax_amount, net_amount, paid_amount, remaining_amount, status, due_date, billing_notes, created_by)
      VALUES 
      ('${invNumber}', 1, 1, 1, 1, 645.00, 'fixed', 0.00, 45.00, 5.00, 30.00, 630.00, 630.00, 0.00, 'paid', CURDATE(), 'Comprehensive outpatient cardiac diagnostic evaluation package', 1)
    `);

    const invId = invRes.insertId;

    await db.query(`
      INSERT INTO invoice_items 
      (invoice_id, service_type, item_name, item_description, quantity, unit_price, subtotal, discount_amount, tax_amount, total_price)
      VALUES 
      (${invId}, 'consultation', 'Specialist Outpatient Consultation', 'Dr. Alexander Vance Cardiology Assessment', 1, 150.00, 150.00, 0.00, 7.50, 157.50),
      (${invId}, 'radiology', 'Transthoracic Echocardiogram with Doppler Flow', 'Structural cardiac ultrasound', 1, 350.00, 350.00, 45.00, 15.25, 320.25),
      (${invId}, 'laboratory', 'Complete Blood Count (CBC with Differential)', 'Automated 5-part differential blood panel', 1, 35.00, 35.00, 0.00, 1.75, 36.75),
      (${invId}, 'procedure', 'Standard 12-Lead Electrocardiogram (ECG)', 'Resting 12-lead tracing & rhythm report', 1, 55.00, 55.00, 0.00, 2.75, 57.75),
      (${invId}, 'pharmacy', 'Metoprolol Tartrate 50mg Tablets', 'Dispensed 30 tablets', 1, 55.00, 55.00, 0.00, 2.75, 57.75)
    `);

    await db.query(`
      INSERT INTO payments 
      (receipt_number, invoice_id, patient_id, amount_paid, payment_method, transaction_ref, payment_date, received_by, notes, status)
      VALUES 
      ('REC-2026-000101', ${invId}, 1, 630.00, 'credit_card', 'TXN-VISA-994821', NOW(), 1, 'Full settlement via Visa Corporate Card', 'completed')
    `);

    console.log('✅ Seeded initial itemized clinical invoice and payment receipt.');
  }

  console.log('🎉 Billing and Invoice Management Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migrateBillingModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateBillingModule;
