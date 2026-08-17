const db = require('../server/config/db');

async function migratePaymentModule() {
  console.log('💰 Starting Payment Management Module Database Migration...');

  // 1. Create payment_methods table
  await db.query(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      category ENUM('cash', 'card', 'bank', 'digital', 'insurance', 'other') NOT NULL DEFAULT 'other',
      requires_ref TINYINT(1) DEFAULT 0,
      fee_percent DECIMAL(5,2) DEFAULT 0.00,
      description TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pm_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified payment_methods table in MySQL.');

  // Seed default payment methods
  const [existingMethods] = await db.query('SELECT COUNT(*) as count FROM payment_methods');
  if (existingMethods[0].count === 0) {
    await db.query(`
      INSERT INTO payment_methods (code, name, category, requires_ref, fee_percent, description)
      VALUES
      ('cash', 'Cash Settlement', 'cash', 0, 0.00, 'Physical cash receipt collected at clinic cashier counter'),
      ('card', 'Credit / Debit Card Terminal', 'card', 1, 0.00, 'POS card swipe/chip (Visa, MasterCard, Amex, Discover)'),
      ('bank_transfer', 'Direct Bank Wire / ACH Transfer', 'bank', 1, 0.00, 'Direct institutional bank wire or ACH electronic transfer'),
      ('online', 'Online Payment Portal / Gateway', 'digital', 1, 0.00, 'Online web portal settlement via Stripe / Apple Pay / Google Pay'),
      ('insurance_claim', 'Third-Party Health Insurance Claim', 'insurance', 1, 0.00, 'Insurance direct billing settlement (BlueCross, Aetna, Cigna, Medicare)'),
      ('cheque', 'Bank Cashier Cheque / Demand Draft', 'bank', 1, 0.00, 'Certified bank draft or corporate payment voucher'),
      ('mobile_money', 'Mobile Wallet / QR Payment', 'digital', 1, 0.00, 'Instant contactless mobile wallet scan and pay')
    `);
    console.log('✅ Seeded 7 configurable payment methods.');
  }

  // 2. Enhance payments table
  const [payCols] = await db.query('DESCRIBE payments');
  const payColNames = payCols.map(c => c.Field);

  if (!payColNames.includes('refunded_amount')) {
    await db.query('ALTER TABLE payments ADD COLUMN refunded_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00');
  }
  if (!payColNames.includes('payer_name')) {
    await db.query('ALTER TABLE payments ADD COLUMN payer_name VARCHAR(150) NULL');
  }
  if (!payColNames.includes('payer_phone')) {
    await db.query('ALTER TABLE payments ADD COLUMN payer_phone VARCHAR(50) NULL');
  }
  if (!payColNames.includes('card_last_four')) {
    await db.query('ALTER TABLE payments ADD COLUMN card_last_four VARCHAR(10) NULL');
  }

  console.log('✅ Enhanced payments schema with refund tracking and payer details.');

  // 3. Create payment_refunds table
  await db.query(`
    CREATE TABLE IF NOT EXISTS payment_refunds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      refund_number VARCHAR(40) NOT NULL UNIQUE,
      payment_id INT NOT NULL,
      invoice_id INT NOT NULL,
      patient_id INT NOT NULL,
      refund_amount DECIMAL(10,2) NOT NULL,
      refund_method VARCHAR(50) NOT NULL DEFAULT 'original_method',
      refund_reason TEXT NOT NULL,
      authorized_by INT NOT NULL,
      refund_date DATETIME NOT NULL,
      status ENUM('approved', 'processed', 'rejected') DEFAULT 'processed',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (authorized_by) REFERENCES users(id),
      INDEX idx_pr_pay (payment_id),
      INDEX idx_pr_inv (invoice_id),
      INDEX idx_pr_pat (patient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified payment_refunds table in MySQL.');

  // 4. Create payment_audit_logs table
  await db.query(`
    CREATE TABLE IF NOT EXISTS payment_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      payment_id INT NULL,
      invoice_id INT NOT NULL,
      action_type ENUM('payment_recorded', 'partial_payment', 'full_settlement', 'payment_refunded', 'payment_voided') NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      actor_user_id INT NOT NULL,
      actor_role VARCHAR(50) NOT NULL,
      ip_address VARCHAR(50) NULL,
      details JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_user_id) REFERENCES users(id),
      INDEX idx_pal_inv (invoice_id),
      INDEX idx_pal_pay (payment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified payment_audit_logs table in MySQL.');

  console.log('🎉 Payment Management Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migratePaymentModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migratePaymentModule;
