const db = require('../server/config/db');

async function migrateInventoryModule() {
  console.log('📦 Starting Hospital Inventory Management Module Database Migration...');

  // 1. Create inventory_categories table
  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      code VARCHAR(30) NOT NULL UNIQUE,
      item_type ENUM('medical_supply', 'surgical_item', 'equipment', 'consumable', 'cleaning_supply', 'general_inventory') NOT NULL,
      description TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified inventory_categories table in MySQL.');

  // Seed default categories
  const [existingCats] = await db.query('SELECT COUNT(*) as count FROM inventory_categories');
  if (existingCats[0].count === 0) {
    await db.query(`
      INSERT INTO inventory_categories (name, code, item_type, description) VALUES
      ('Medical & Nursing Supplies', 'MED-SUP', 'medical_supply', 'Clinical diagnostic and nursing supplies: syringes, cannulas, catheters, IV lines'),
      ('Surgical & Operation Theatre (OT)', 'SURG-OT', 'surgical_item', 'Sterile surgical instruments, scalpel blades, suture packs, and laparotomy drapes'),
      ('Biomedical & Diagnostic Equipment', 'BIOMED-EQ', 'equipment', 'Patient monitors, defibrillators, infusion pumps, suction units, and ECG machines'),
      ('Daily Clinical Consumables', 'CONSUM', 'consumable', 'Latex gloves, alcohol swabs, cotton rolls, bandages, and sample collection vials'),
      ('Cleaning & Hospital Sanitization', 'CLEAN', 'cleaning_supply', 'High-level disinfectants, surface virucidal wipes, autoclave packs, and biohazard bags'),
      ('General Hospital Inventory & Linen', 'GEN-LIN', 'general_inventory', 'Hospital patient beds, wheelchairs, linen sets, scrubs, and medical stationery')
    `);
    console.log('✅ Seeded 6 comprehensive hospital inventory categories.');
  }

  // 2. Create inventory_suppliers table
  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory_suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      contact_person VARCHAR(100) NULL,
      phone VARCHAR(30) NOT NULL,
      email VARCHAR(100) NULL,
      address TEXT NULL,
      tax_id VARCHAR(50) NULL,
      payment_terms VARCHAR(60) DEFAULT 'Net 30 Days',
      status ENUM('active', 'inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified inventory_suppliers table in MySQL.');

  // Seed default suppliers
  const [existingSupps] = await db.query('SELECT COUNT(*) as count FROM inventory_suppliers');
  if (existingSupps[0].count === 0) {
    await db.query(`
      INSERT INTO inventory_suppliers (name, code, contact_person, phone, email, address, tax_id, payment_terms) VALUES
      ('Becton Dickinson (BD) MedTech', 'SUP-2026-001', 'Robert Hayes', '+1 (800) 555-0199', 'orders@bdmedtech.com', '1 Becton Drive, Franklin Lakes, NJ', 'US-TAX-889921', 'Net 30 Days'),
      ('Ethicon Surgical Solutions (J&J)', 'SUP-2026-002', 'Dr. Cynthia Miller', '+1 (800) 555-0244', 'supply@ethicon-jnj.com', 'Route 22 West, Somerville, NJ', 'US-TAX-334412', 'Net 30 Days'),
      ('Mindray Bio-Medical Electronics', 'SUP-2026-003', 'Kevin Chen', '+1 (800) 555-0377', 'hospital-sales@mindray.com', '800 MacArthur Blvd, Mahwah, NJ', 'US-TAX-556677', 'Net 45 Days'),
      ('Ecolab Healthcare Sanitization', 'SUP-2026-004', 'Maria Gonzalez', '+1 (800) 555-0488', 'healthcare@ecolab.com', '1 Ecolab Place, St. Paul, MN', 'US-TAX-998811', 'Net 15 Days'),
      ('Medline Industries Inc.', 'SUP-2026-005', 'Daniel Parker', '+1 (800) 555-0566', 'orders@medline.com', 'Three Lakes Drive, Northfield, IL', 'US-TAX-112233', 'Net 30 Days')
    `);
    console.log('✅ Seeded 5 major hospital suppliers and healthcare distributors.');
  }

  // 3. Create inventory_items table
  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_id INT NOT NULL,
      supplier_id INT NULL,
      item_code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(180) NOT NULL,
      generic_spec VARCHAR(200) NULL,
      item_type ENUM('medical_supply', 'surgical_item', 'equipment', 'consumable', 'cleaning_supply', 'general_inventory') NOT NULL,
      unit_of_measure VARCHAR(30) NOT NULL,
      current_stock INT NOT NULL DEFAULT 0,
      min_stock_level INT NOT NULL DEFAULT 10,
      max_stock_level INT NOT NULL DEFAULT 500,
      unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      storage_location VARCHAR(80) NOT NULL DEFAULT 'Central Supply Room A-1',
      model_number VARCHAR(80) NULL,
      serial_number VARCHAR(80) NULL,
      batch_number VARCHAR(60) NULL,
      expiry_date DATE NULL,
      status ENUM('in_stock', 'low_stock', 'out_of_stock', 'expired') DEFAULT 'in_stock',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES inventory_categories(id) ON DELETE CASCADE,
      FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id) ON DELETE SET NULL,
      INDEX idx_inv_code (item_code),
      INDEX idx_inv_type (item_type),
      INDEX idx_inv_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified inventory_items table in MySQL.');

  // 4. Create inventory_purchase_orders table
  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      po_number VARCHAR(40) NOT NULL UNIQUE,
      supplier_id INT NOT NULL,
      order_date DATE NOT NULL,
      expected_delivery_date DATE NULL,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      status ENUM('draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled') DEFAULT 'draft',
      created_by INT NOT NULL,
      approved_by INT NULL,
      received_at DATETIME NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES inventory_suppliers(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_po_status (status),
      INDEX idx_po_date (order_date DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified inventory_purchase_orders table in MySQL.');

  // 5. Create inventory_po_items table
  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory_po_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      po_id INT NOT NULL,
      item_id INT NOT NULL,
      item_name VARCHAR(180) NOT NULL,
      unit_of_measure VARCHAR(30) NOT NULL,
      quantity_ordered INT NOT NULL,
      quantity_received INT NOT NULL DEFAULT 0,
      unit_cost DECIMAL(10,2) NOT NULL,
      total_cost DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (po_id) REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
      INDEX idx_po_item_po (po_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified inventory_po_items table in MySQL.');

  // 6. Create inventory_transactions table
  await db.query(`
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_number VARCHAR(40) NOT NULL UNIQUE,
      item_id INT NOT NULL,
      transaction_type ENUM('stock_in_purchase', 'stock_out_issuance', 'adjustment_audit', 'damaged_writeoff', 'return_to_supplier', 'department_transfer') NOT NULL,
      quantity INT NOT NULL,
      unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      total_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      stock_before INT NOT NULL,
      stock_after INT NOT NULL,
      batch_number VARCHAR(60) NULL,
      expiry_date DATE NULL,
      department_id INT NULL,
      issued_to_person VARCHAR(100) NULL,
      reference_type ENUM('purchase_order', 'department_issuance', 'manual_audit', 'supplier_return', 'damaged_report') DEFAULT 'manual_audit',
      reference_id INT NULL,
      performed_by INT NOT NULL,
      notes TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
      FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_txn_item (item_id, created_at DESC),
      INDEX idx_txn_type (transaction_type),
      INDEX idx_txn_date (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified inventory_transactions table in MySQL.');

  // Seed default inventory items
  const [existingItems] = await db.query('SELECT COUNT(*) as count FROM inventory_items');
  if (existingItems[0].count === 0) {
    console.log('Seeding 18 standard hospital inventory items across all 6 categories...');

    await db.query(`
      INSERT INTO inventory_items 
      (category_id, supplier_id, item_code, name, generic_spec, item_type, unit_of_measure, current_stock, min_stock_level, max_stock_level, unit_cost, storage_location, batch_number, expiry_date, status)
      VALUES
      -- Medical Supplies
      (1, 1, 'MED-SYR-001', 'Sterile Syringe 5ml with 21G Needle', '3-Part Luer-Lock Single-use hypodermic syringe', 'medical_supply', 'Box (100 pcs)', 250, 40, 600, 14.50, 'Central Supply Bay A-1', 'BAT-2026-SYR-01', '2029-12-31', 'in_stock'),
      (1, 1, 'MED-CAN-002', 'IV Cannula 20G (Pink) with Port', 'PTFE radiopaque catheter with safety needle shield', 'medical_supply', 'Box (50 pcs)', 180, 30, 500, 22.00, 'Central Supply Bay A-2', 'BAT-2026-CAN-02', '2028-09-30', 'in_stock'),
      (1, 5, 'MED-INF-003', 'Primary IV Infusion Administration Set', 'Vented 20 drops/ml with Luer lock and roller clamp', 'medical_supply', 'Pack (25 pcs)', 120, 25, 300, 18.75, 'Central Supply Bay A-3', 'BAT-2026-INF-03', '2028-06-30', 'in_stock'),
      (1, 5, 'MED-FOL-004', 'Foley Urinary Catheter 16Fr 2-Way', '100% Medical Grade Silicone with 10ml balloon', 'medical_supply', 'Piece / Unit', 75, 20, 200, 4.20, 'Central Supply Bay A-4', 'BAT-2026-FOL-04', '2028-11-30', 'in_stock'),

      -- Surgical & OT Items
      (2, 2, 'SURG-BLD-001', 'Surgical Scalpel Blades #10 Sterile', 'Carbon steel precision surgical scalpel blade', 'surgical_item', 'Box (100 pcs)', 85, 20, 250, 28.00, 'OT Sterile Core Shelf 1', 'BAT-2026-BLD-01', '2030-01-31', 'in_stock'),
      (2, 2, 'SURG-SUT-002', 'Vicryl 3-0 Absorbable Suture (Polyglactin 910)', '75cm with 26mm 1/2 circle taper point needle', 'surgical_item', 'Box (36 pcs)', 60, 15, 150, 68.50, 'OT Sterile Core Shelf 2', 'BAT-2026-SUT-02', '2028-05-31', 'in_stock'),
      (2, 2, 'SURG-LAP-003', 'Laparotomy Surgical Sponges with X-Ray Detectable', 'Pre-washed 100% cotton 45x45cm sterile', 'surgical_item', 'Pack (5 pcs)', 110, 30, 300, 12.00, 'OT Sterile Core Shelf 3', 'BAT-2026-LAP-03', '2029-08-31', 'in_stock'),
      (2, 5, 'SURG-DRP-004', 'Universal Surgical Drape Pack with Pouch', 'Impervious SMS fabric with fluid collection pouch', 'surgical_item', 'Set', 45, 15, 100, 34.00, 'OT Sterile Core Shelf 4', 'BAT-2026-DRP-04', '2028-10-31', 'in_stock'),

      -- Biomedical Equipment
      (3, 3, 'EQ-MON-001', 'Mindray ePM 10M Vital Signs Multi-Para Monitor', '10-inch Touchscreen NIBP, SpO2, ECG 5-Lead, Temp', 'equipment', 'Piece / Unit', 14, 3, 20, 2450.00, 'Biomedical Depot Room 102', 'BAT-2026-EQ-01', NULL, 'in_stock'),
      (3, 3, 'EQ-DEF-002', 'BeneHeart D3 Defibrillator & Monitor Unit', 'Biphasic manual/AED with pacing and CPR feedback', 'equipment', 'Piece / Unit', 6, 2, 10, 4800.00, 'Emergency Resuscitation Bay', 'BAT-2026-EQ-02', NULL, 'in_stock'),
      (3, 3, 'EQ-INF-003', 'BeneFusion VP3 Volumetric Infusion Pump', 'High precision micro/macro pump with drug library', 'equipment', 'Piece / Unit', 22, 5, 40, 850.00, 'Biomedical Depot Room 102', 'BAT-2026-EQ-03', NULL, 'in_stock'),

      -- Consumables
      (4, 5, 'CON-GLV-001', 'Nitrile Medical Examination Gloves (Medium)', 'Powder-free textured fingertips chemo-tested', 'consumable', 'Box (100 pcs)', 320, 50, 800, 8.50, 'Consumables Bay C-1', 'BAT-2026-GLV-01', '2029-04-30', 'in_stock'),
      (4, 5, 'CON-ALC-002', 'Sterile 70% Isopropyl Alcohol Prep Pads', '2-Ply non-woven antiseptic skin cleansing wipe', 'consumable', 'Box (200 pcs)', 240, 40, 600, 6.20, 'Consumables Bay C-2', 'BAT-2026-ALC-02', '2028-12-31', 'in_stock'),
      (4, 1, 'CON-TUB-003', 'BD Vacutainer K2-EDTA Blood Collection Tubes 4ml', 'Lavender top spray-coated glass tube', 'consumable', 'Pack (100 pcs)', 150, 30, 400, 19.80, 'Lab Phlebotomy Store', 'BAT-2026-TUB-03', '2027-10-31', 'in_stock'),

      -- Cleaning & Sanitation
      (5, 4, 'CLN-DIS-001', 'OxyCide Daily Hospital Disinfectant Cleaner 3.8L', 'Hydrogen peroxide & peracetic acid broad-spectrum', 'cleaning_supply', 'Bottle (1000ml)', 65, 20, 150, 32.00, 'Sanitation Supply Bay D', 'BAT-2026-DIS-01', '2027-08-31', 'in_stock'),
      (5, 4, 'CLN-RUB-002', 'Avagard Antiseptic Hand Rub with Chlorhexidine 500ml', '70% v/v ethyl alcohol waterless surgical scrub', 'cleaning_supply', 'Bottle (1000ml)', 90, 25, 250, 11.50, 'Sanitation Supply Bay D', 'BAT-2026-RUB-02', '2028-02-28', 'in_stock'),
      (5, 5, 'CLN-BAG-003', 'Heavy-Duty Biohazard Waste Bags (Red 30 Gallon)', 'ASTM tear and dart impact tested infectious waste', 'cleaning_supply', 'Roll (50 pcs)', 140, 30, 300, 24.00, 'Sanitation Supply Bay D', 'BAT-2026-BAG-03', NULL, 'in_stock'),

      -- General Inventory & Linen
      (6, 5, 'GEN-WCH-001', 'Heavy Duty Hospital Transport Wheelchair', 'Foldable steel frame with swing-away footrests', 'general_inventory', 'Piece / Unit', 18, 4, 30, 220.00, 'Hospital Equipment Bay E', 'BAT-2026-WCH-01', NULL, 'in_stock')
    `);
    console.log('✅ Seeded 18 clinical inventory items across all 6 modalities.');

    // Seed initial purchase order
    const [poRes] = await db.query(`
      INSERT INTO inventory_purchase_orders 
      (po_number, supplier_id, order_date, expected_delivery_date, subtotal, tax_amount, total_amount, status, created_by, approved_by, received_at, notes)
      VALUES 
      ('PO-2026-000101', 1, DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_SUB(CURDATE(), INTERVAL 2 DAY), 2200.00, 110.00, 2310.00, 'received', 1, 1, DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'Quarterly clinical consumables & syringes batch delivery.')
    `);

    await db.query(`
      INSERT INTO inventory_po_items 
      (po_id, item_id, item_name, unit_of_measure, quantity_ordered, quantity_received, unit_cost, total_cost)
      VALUES 
      (${poRes.insertId}, 1, 'Sterile Syringe 5ml with 21G Needle', 'Box (100 pcs)', 100, 100, 14.50, 1450.00),
      (${poRes.insertId}, 2, 'IV Cannula 20G (Pink) with Port', 'Box (50 pcs)', 30, 30, 22.00, 660.00)
    `);

    // Seed initial stock-in transactions
    await db.query(`
      INSERT INTO inventory_transactions 
      (transaction_number, item_id, transaction_type, quantity, unit_cost, total_cost, stock_before, stock_after, batch_number, expiry_date, reference_type, reference_id, performed_by, notes)
      VALUES 
      ('TXN-2026-000101', 1, 'stock_in_purchase', 100, 14.50, 1450.00, 150, 250, 'BAT-2026-SYR-01', '2029-12-31', 'purchase_order', ${poRes.insertId}, 1, 'Received from PO-2026-000101 (Becton Dickinson)'),
      ('TXN-2026-000102', 2, 'stock_in_purchase', 30, 22.00, 660.00, 150, 180, 'BAT-2026-CAN-02', '2028-09-30', 'purchase_order', ${poRes.insertId}, 1, 'Received from PO-2026-000101 (Becton Dickinson)'),
      ('TXN-2026-000103', 1, 'stock_out_issuance', -20, 14.50, 290.00, 270, 250, 'BAT-2026-SYR-01', '2029-12-31', 'department_issuance', NULL, 1, 'Issued to Cardiology OPD Clinic (Nurse Sarah)')
    `);

    console.log('✅ Seeded initial purchase order and inventory audit transactions.');
  }

  // Create a low-stock test item
  await db.query(`
    UPDATE inventory_items 
    SET current_stock = 8, min_stock_level = 20, status = 'low_stock' 
    WHERE id = 8
  `);

  console.log('🎉 Hospital Inventory Management Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migrateInventoryModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateInventoryModule;
