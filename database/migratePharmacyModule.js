const db = require('../server/config/db');

async function migratePharmacyModule() {
  console.log('💊 Starting Pharmacy Management Module Database Migration...');

  // 1. Create pharmacy_categories table
  await db.query(`
    CREATE TABLE IF NOT EXISTS pharmacy_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      code VARCHAR(30) NOT NULL UNIQUE,
      description TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified pharmacy_categories table in MySQL.');

  // Seed default categories
  const [existingCats] = await db.query('SELECT COUNT(*) as count FROM pharmacy_categories');
  if (existingCats[0].count === 0) {
    await db.query(`
      INSERT INTO pharmacy_categories (name, code, description) VALUES
      ('Antibiotics & Antimicrobials', 'ABX', 'Broad and narrow spectrum antibacterial agents'),
      ('Cardiovascular & Antihypertensives', 'CVD', 'ACE inhibitors, ARBs, Beta-blockers, Statins, and Antiarrhythmics'),
      ('Analgesics & Anti-inflammatory (NSAIDs)', 'PAIN', 'Pain management, Antipyretics, and NSAIDs'),
      ('Antidiabetics & Endocrine', 'DIA', 'Oral hypoglycemics, Insulins, and Thyroid hormones'),
      ('Respiratory & Bronchodilators', 'RESP', 'Inhalers, Antihistamines, Mucolytics, and Bronchodilators'),
      ('Gastrointestinal & Antacids', 'GI', 'Proton pump inhibitors, H2 blockers, Antispasmodics, and Antiemetics'),
      ('Psychotropics & Neuro', 'NEURO', 'Anticonvulsants, Anxiolytics, Antidepressants, and Sedatives'),
      ('IV Fluids & Electrolytes', 'IVF', 'Normal Saline, Ringer Lactate, Dextrose, and Electrolytes'),
      ('Dermatologicals & Topicals', 'DERM', 'Ointments, Creams, Antifungal and Steroid topicals'),
      ('Vitamins & Nutritional Supplements', 'VIT', 'Multivitamins, Minerals, Iron, Calcium, and Vitamin D3')
    `);
    console.log('✅ Seeded 10 standard pharmacy therapeutic categories.');
  }

  // 2. Enhance medicines table with batch, purchase price, selling price, category link, location shelf
  const [medCols] = await db.query('DESCRIBE medicines');
  const colNames = medCols.map(c => c.Field);

  if (!colNames.includes('batch_number')) {
    await db.query("ALTER TABLE medicines ADD COLUMN batch_number VARCHAR(60) DEFAULT 'BAT-2026-001' AFTER strength");
    console.log('✅ Added batch_number column to medicines.');
  }
  if (!colNames.includes('purchase_price')) {
    await db.query('ALTER TABLE medicines ADD COLUMN purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER unit_price');
    console.log('✅ Added purchase_price column to medicines.');
  }
  if (!colNames.includes('selling_price')) {
    await db.query('ALTER TABLE medicines ADD COLUMN selling_price DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER purchase_price');
    console.log('✅ Added selling_price column to medicines.');
  }
  if (!colNames.includes('location_shelf')) {
    await db.query("ALTER TABLE medicines ADD COLUMN location_shelf VARCHAR(50) DEFAULT 'Shelf A-1' AFTER manufacturer");
    console.log('✅ Added location_shelf column to medicines.');
  }
  if (!colNames.includes('requires_prescription')) {
    await db.query('ALTER TABLE medicines ADD COLUMN requires_prescription TINYINT(1) DEFAULT 1 AFTER location_shelf');
    console.log('✅ Added requires_prescription column to medicines.');
  }
  if (!colNames.includes('is_active')) {
    await db.query('ALTER TABLE medicines ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER status');
    console.log('✅ Added is_active column to medicines.');
  }

  // Update existing medicines selling_price & purchase_price if 0
  await db.query(`
    UPDATE medicines 
    SET selling_price = unit_price,
        purchase_price = ROUND(unit_price * 0.65, 2),
        batch_number = CONCAT('BAT-2026-', LPAD(id, 4, '0')),
        location_shelf = CONCAT('Shelf ', CHAR(65 + (id % 6)), '-', (id % 8) + 1)
    WHERE selling_price = 0 OR purchase_price = 0
  `);
  console.log('✅ Synchronized purchase prices, selling prices, batches, and shelf locations on all medicines.');

  // 3. Create pharmacy_stock_adjustments table
  await db.query(`
    CREATE TABLE IF NOT EXISTS pharmacy_stock_adjustments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      medicine_id INT NOT NULL,
      adjustment_type ENUM('purchase_received', 'dispensed', 'sold_pos', 'returned', 'damaged_expired', 'inventory_audit', 'correction') NOT NULL,
      quantity_change INT NOT NULL,
      stock_before INT NOT NULL,
      stock_after INT NOT NULL,
      batch_number VARCHAR(60) NULL,
      reason VARCHAR(255) NOT NULL,
      reference_type ENUM('prescription', 'sale', 'return', 'manual_audit', 'purchase_order') DEFAULT 'manual_audit',
      reference_id INT NULL,
      performed_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
      FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_adj_med (medicine_id, created_at DESC),
      INDEX idx_adj_type (adjustment_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified pharmacy_stock_adjustments table in MySQL.');

  // 4. Create pharmacy_sales table
  await db.query(`
    CREATE TABLE IF NOT EXISTS pharmacy_sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_number VARCHAR(40) NOT NULL UNIQUE,
      patient_id INT NULL,
      prescription_id INT NULL,
      doctor_id INT NULL,
      customer_name VARCHAR(120) NOT NULL,
      customer_phone VARCHAR(30) NULL,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      payment_method ENUM('cash', 'card', 'insurance', 'online', 'unpaid') DEFAULT 'cash',
      payment_status ENUM('paid', 'partially_paid', 'pending', 'refunded') DEFAULT 'paid',
      status ENUM('completed', 'partially_returned', 'returned', 'cancelled') DEFAULT 'completed',
      dispensed_by INT NOT NULL,
      dispensed_at DATETIME NOT NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
      FOREIGN KEY (prescription_id) REFERENCES prescription_orders(id) ON DELETE SET NULL,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
      FOREIGN KEY (dispensed_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_ph_sale_pat (patient_id),
      INDEX idx_ph_sale_date (dispensed_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified pharmacy_sales table in MySQL.');

  // 5. Create pharmacy_sale_items table
  await db.query(`
    CREATE TABLE IF NOT EXISTS pharmacy_sale_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id INT NOT NULL,
      medicine_id INT NOT NULL,
      medicine_name VARCHAR(150) NOT NULL,
      generic_name VARCHAR(150) NULL,
      batch_number VARCHAR(60) NULL,
      expiry_date DATE NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      total_price DECIMAL(10,2) NOT NULL,
      returned_quantity INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES pharmacy_sales(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
      INDEX idx_ph_item_sale (sale_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified pharmacy_sale_items table in MySQL.');

  // 6. Create pharmacy_returns table
  await db.query(`
    CREATE TABLE IF NOT EXISTS pharmacy_returns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      return_number VARCHAR(40) NOT NULL UNIQUE,
      sale_id INT NOT NULL,
      sale_item_id INT NOT NULL,
      medicine_id INT NOT NULL,
      quantity_returned INT NOT NULL,
      refund_amount DECIMAL(10,2) NOT NULL,
      reason VARCHAR(255) NOT NULL,
      restock_item TINYINT(1) DEFAULT 1,
      processed_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES pharmacy_sales(id) ON DELETE CASCADE,
      FOREIGN KEY (sale_item_id) REFERENCES pharmacy_sale_items(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE,
      FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_ph_ret_sale (sale_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified pharmacy_returns table in MySQL.');

  // Seed sample initial sales & stock history if empty
  const [existingSales] = await db.query('SELECT COUNT(*) as count FROM pharmacy_sales');
  if (existingSales[0].count === 0) {
    console.log('Seeding initial pharmacy sales, dispensation receipts, and stock ledger...');

    // Sale 1: Dispensed Prescription for Patient 1 (Arthur)
    const [saleRes1] = await db.query(`
      INSERT INTO pharmacy_sales 
      (invoice_number, patient_id, prescription_id, doctor_id, customer_name, customer_phone, subtotal, discount, tax, total_amount, payment_method, payment_status, status, dispensed_by, dispensed_at, notes)
      VALUES 
      ('PHARM-2026-000101', 1, 1, 1, 'Arthur Pendleton', '555-0101', 54.00, 0.00, 2.70, 56.70, 'cash', 'paid', 'completed', 1, DATE_SUB(NOW(), INTERVAL 3 DAY), 'Dispensed per cardiology prescription RX-2026-000101.')
    `);

    await db.query(`
      INSERT INTO pharmacy_sale_items 
      (sale_id, medicine_id, medicine_name, generic_name, batch_number, expiry_date, quantity, unit_price, total_price)
      VALUES 
      (${saleRes1.insertId}, 1, 'Amoxicillin 500mg', 'Amoxicillin', 'BAT-2026-0001', '2027-06-30', 20, 1.20, 24.00),
      (${saleRes1.insertId}, 3, 'Atorvastatin 20mg', 'Atorvastatin Calcium', 'BAT-2026-0003', '2027-11-30', 30, 1.00, 30.00)
    `);

    // Sale 2: Walk-in OTC Customer Sale
    const [saleRes2] = await db.query(`
      INSERT INTO pharmacy_sales 
      (invoice_number, patient_id, customer_name, customer_phone, subtotal, discount, tax, total_amount, payment_method, payment_status, status, dispensed_by, dispensed_at, notes)
      VALUES 
      ('PHARM-2026-000102', NULL, 'Robert Langdon (Walk-in OTC)', '555-4499', 18.50, 0.00, 0.93, 19.43, 'card', 'paid', 'completed', 1, DATE_SUB(NOW(), INTERVAL 1 DAY), 'Walk-in OTC pain relief and antacid purchase.')
    `);

    await db.query(`
      INSERT INTO pharmacy_sale_items 
      (sale_id, medicine_id, medicine_name, generic_name, batch_number, expiry_date, quantity, unit_price, total_price)
      VALUES 
      (${saleRes2.insertId}, 2, 'Paracetamol 500mg', 'Acetaminophen', 'BAT-2026-0002', '2028-01-31', 20, 0.25, 5.00),
      (${saleRes2.insertId}, 6, 'Omeprazole 20mg', 'Omeprazole', 'BAT-2026-0006', '2027-09-30', 15, 0.90, 13.50)
    `);

    // Initial stock adjustment records
    await db.query(`
      INSERT INTO pharmacy_stock_adjustments 
      (medicine_id, adjustment_type, quantity_change, stock_before, stock_after, batch_number, reason, reference_type, reference_id, performed_by)
      VALUES 
      (1, 'dispensed', -20, 500, 480, 'BAT-2026-0001', 'Dispensed for Prescription #1 (Arthur Pendleton)', 'prescription', 1, 1),
      (3, 'dispensed', -30, 400, 370, 'BAT-2026-0003', 'Dispensed for Prescription #1 (Arthur Pendleton)', 'prescription', 1, 1),
      (2, 'sold_pos', -20, 1000, 980, 'BAT-2026-0002', 'Direct POS Walk-in Sale PHARM-2026-000102', 'sale', ${saleRes2.insertId}, 1),
      (6, 'sold_pos', -15, 350, 335, 'BAT-2026-0006', 'Direct POS Walk-in Sale PHARM-2026-000102', 'sale', ${saleRes2.insertId}, 1)
    `);

    console.log('✅ Seeded initial pharmacy sales, line items, and stock ledger.');
  }

  // Ensure test low stock and expiring items for alerts validation
  await db.query(`
    UPDATE medicines 
    SET stock_quantity = 8, min_stock_level = 20, status = 'low_stock' 
    WHERE id = 8
  `);
  await db.query(`
    UPDATE medicines 
    SET expiry_date = DATE_ADD(CURDATE(), INTERVAL 15 DAY) 
    WHERE id = 9
  `);

  console.log('🎉 Pharmacy Management Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migratePharmacyModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migratePharmacyModule;
