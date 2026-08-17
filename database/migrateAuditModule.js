const db = require('../server/config/db');

async function migrateAuditModule() {
  console.log('🛡️ Starting Security Audit Logging Module Database Migration...');

  // 1. Create or upgrade audit_logs table
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      user_name VARCHAR(150) NULL,
      user_role VARCHAR(100) NULL,
      action VARCHAR(100) NOT NULL,
      module VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
      entity VARCHAR(100) NULL,
      entity_id VARCHAR(100) NULL,
      record_id VARCHAR(100) NULL,
      ip_address VARCHAR(100) NULL,
      user_agent TEXT NULL,
      description TEXT NULL,
      details_json LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_audit_action (action),
      INDEX idx_audit_module (module),
      INDEX idx_audit_user (user_id),
      INDEX idx_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  // Ensure all columns exist if table pre-existed
  const [cols] = await db.query('DESCRIBE audit_logs');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('user_name')) {
    await db.query('ALTER TABLE audit_logs ADD COLUMN user_name VARCHAR(150) NULL AFTER user_id');
  }
  if (!colNames.includes('user_role')) {
    await db.query('ALTER TABLE audit_logs ADD COLUMN user_role VARCHAR(100) NULL AFTER user_name');
  }
  if (!colNames.includes('module')) {
    await db.query("ALTER TABLE audit_logs ADD COLUMN module VARCHAR(100) NOT NULL DEFAULT 'SYSTEM' AFTER action");
  }
  if (!colNames.includes('record_id')) {
    await db.query('ALTER TABLE audit_logs ADD COLUMN record_id VARCHAR(100) NULL AFTER entity_id');
  }
  if (!colNames.includes('description')) {
    await db.query('ALTER TABLE audit_logs ADD COLUMN description TEXT NULL AFTER user_agent');
  }

  // 2. Synchronize existing records to populate module and description if null
  await db.query(`
    UPDATE audit_logs SET 
      module = COALESCE(entity, 'SYSTEM'),
      record_id = COALESCE(entity_id, 'N/A'),
      description = COALESCE(description, CONCAT(action, ' on ', COALESCE(entity, 'record'), ' #', COALESCE(entity_id, 'N/A')))
    WHERE module IS NULL OR module = 'SYSTEM' OR description IS NULL
  `);

  // 3. Seed comprehensive audit records across all 11 required tracking modalities
  const [countRows] = await db.query('SELECT COUNT(*) as count FROM audit_logs');
  if (countRows[0].count < 11) {
    const seedEvents = [
      {
        user_id: 1, user_name: 'Dr. Administrator', user_role: 'super_admin',
        action: 'LOGIN', module: 'AUTH', record_id: '1', ip_address: '192.168.1.100',
        description: 'Super Administrator signed in successfully with JWT authentication.',
        details_json: JSON.stringify({ method: 'password', mfa_verified: true })
      },
      {
        user_id: 3, user_name: 'Dr. Marcus Vance', user_role: 'doctor',
        action: 'LOGOUT', module: 'AUTH', record_id: '3', ip_address: '192.168.1.105',
        description: 'Doctor Marcus Vance initiated graceful session sign out.',
        details_json: JSON.stringify({ session_duration_minutes: 420 })
      },
      {
        user_id: 5, user_name: 'Receptionist Sarah Jenkins', user_role: 'receptionist',
        action: 'CREATE', module: 'PATIENTS', record_id: '1', ip_address: '192.168.1.110',
        description: 'Registered new patient Arthur Pendleton with code PAT-2026-0001.',
        details_json: JSON.stringify({ patient_code: 'PAT-2026-0001', name: 'Arthur Pendleton' })
      },
      {
        user_id: 3, user_name: 'Dr. Marcus Vance', user_role: 'doctor',
        action: 'UPDATE', module: 'APPOINTMENTS', record_id: '1', ip_address: '192.168.1.105',
        description: 'Updated appointment #1 status from confirmed to completed.',
        details_json: JSON.stringify({ previous_status: 'confirmed', new_status: 'completed' })
      },
      {
        user_id: 1, user_name: 'Dr. Administrator', user_role: 'super_admin',
        action: 'DELETE', module: 'STAFF', record_id: '99', ip_address: '192.168.1.100',
        description: 'Permanently removed retired contract staff profile ID #99.',
        details_json: JSON.stringify({ employee_id: 'EMP-99', reason: 'Contract Expired' })
      },
      {
        user_id: 3, user_name: 'Dr. Marcus Vance', user_role: 'doctor',
        action: 'MEDICAL_RECORD_ACCESS', module: 'EMR', record_id: '1', ip_address: '192.168.1.105',
        description: 'Accessed clinical electronic medical record and vitals history for Patient Arthur Pendleton.',
        details_json: JSON.stringify({ patient_id: 1, accessed_sections: ['vitals', 'ecg', 'lab_results'] })
      },
      {
        user_id: 3, user_name: 'Dr. Marcus Vance', user_role: 'doctor',
        action: 'PRESCRIPTION_CHANGE', module: 'PRESCRIPTIONS', record_id: '1', ip_address: '192.168.1.105',
        description: 'Modified dosage for Atorvastatin 40mg in active prescription order #1.',
        details_json: JSON.stringify({ prescription_id: 1, previous_dosage: '20mg', new_dosage: '40mg' })
      },
      {
        user_id: 9, user_name: 'Accountant David Miller', user_role: 'accountant',
        action: 'BILLING_CHANGE', module: 'BILLING', record_id: '1', ip_address: '192.168.1.120',
        description: 'Applied 10% senior insurance discount to Invoice #INV-2026-0001.',
        details_json: JSON.stringify({ invoice_number: 'INV-2026-0001', discount_amount: 35.00 })
      },
      {
        user_id: 9, user_name: 'Accountant David Miller', user_role: 'accountant',
        action: 'PAYMENT_CHANGE', module: 'PAYMENTS', record_id: '1', ip_address: '192.168.1.120',
        description: 'Recorded partial payment of $250.00 via Credit Card on Invoice #INV-2026-0001.',
        details_json: JSON.stringify({ amount_paid: 250.00, method: 'Card', balance_remaining: 100.00 })
      },
      {
        user_id: 1, user_name: 'Dr. Administrator', user_role: 'super_admin',
        action: 'PERMISSION_CHANGE', module: 'SECURITY', record_id: '3', ip_address: '192.168.1.100',
        description: 'Granted pharmacy_dispense and inventory_view permissions to clinical nurse role.',
        details_json: JSON.stringify({ role_id: 4, added_permissions: ['pharmacy_dispense'] })
      },
      {
        user_id: 1, user_name: 'Dr. Administrator', user_role: 'super_admin',
        action: 'ACCOUNT_STATUS_CHANGE', module: 'USERS', record_id: '8', ip_address: '192.168.1.100',
        description: 'Reactivated user account for Dr. Kevin Thorne following approved leave.',
        details_json: JSON.stringify({ user_id: 8, previous_status: 'inactive', new_status: 'active' })
      }
    ];

    for (const ev of seedEvents) {
      await db.query(
        `INSERT INTO audit_logs 
         (user_id, user_name, user_role, action, module, entity, entity_id, record_id, ip_address, description, details_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          ev.user_id,
          ev.user_name,
          ev.user_role,
          ev.action,
          ev.module,
          ev.module.toLowerCase(),
          ev.record_id,
          ev.record_id,
          ev.ip_address,
          ev.description,
          ev.details_json
        ]
      );
    }
    console.log('✅ Seeded 11 comprehensive audit events across all core tracking modalities.');
  }

  console.log('🎉 Security Audit Logging Module Migration Completed Successfully!');
}

if (require.main === module) {
  migrateAuditModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateAuditModule;
