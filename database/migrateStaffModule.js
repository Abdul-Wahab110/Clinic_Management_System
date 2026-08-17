const db = require('../server/config/db');

async function migrateStaffModule() {
  console.log('👥 Starting Hospital Staff Management Module Database Migration...');

  // 1. Create staff_profiles table
  await db.query(`
    CREATE TABLE IF NOT EXISTS staff_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      employee_id VARCHAR(40) NOT NULL UNIQUE,
      department_id INT NULL,
      designation VARCHAR(150) NOT NULL,
      staff_type ENUM('doctor', 'nurse', 'receptionist', 'lab_technician', 'pharmacist', 'accountant', 'admin', 'other') NOT NULL DEFAULT 'other',
      joining_date DATE NOT NULL,
      qualification VARCHAR(150) NULL,
      emergency_contact VARCHAR(100) NULL,
      emergency_phone VARCHAR(50) NULL,
      salary_monthly DECIMAL(10,2) NULL,
      status ENUM('active', 'on_leave', 'suspended', 'inactive') NOT NULL DEFAULT 'active',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
      INDEX idx_sp_emp (employee_id),
      INDEX idx_sp_type (staff_type),
      INDEX idx_sp_status (status),
      INDEX idx_sp_dept (department_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified staff_profiles table in MySQL.');

  // 2. Auto-sync existing staff users into staff_profiles if not present
  const [users] = await db.query(`
    SELECT u.id, u.full_name, u.email, u.phone, u.status, r.name as role_name 
    FROM users u 
    JOIN roles r ON u.role_id = r.id 
    WHERE r.name != 'patient'
  `);

  let syncedCount = 0;
  for (const u of users) {
    const [existing] = await db.query('SELECT id FROM staff_profiles WHERE user_id = ?', [u.id]);
    if (existing.length === 0) {
      let staffType = 'other';
      let designation = 'Hospital Staff';
      let deptId = 1; // Default General/Cardiology

      if (u.role_name === 'doctor') {
        staffType = 'doctor';
        designation = 'Attending Physician';
        const [doc] = await db.query('SELECT department_id, specialization FROM doctors WHERE user_id = ?', [u.id]);
        if (doc.length > 0) {
          deptId = doc[0].department_id || 1;
          designation = doc[0].specialization || 'Attending Physician';
        }
      } else if (u.role_name === 'nurse') {
        staffType = 'nurse';
        designation = u.full_name.includes('ICU') ? 'ICU Charge Nurse' : 'Clinical Registered Nurse';
        deptId = 1;
      } else if (u.role_name === 'receptionist') {
        staffType = 'receptionist';
        designation = 'Front Desk Reception Officer';
        deptId = 1;
      } else if (u.role_name === 'lab_technician') {
        staffType = 'lab_technician';
        designation = 'Lead Pathology Technologist';
        deptId = 10; // Pathology / Lab
      } else if (u.role_name === 'pharmacist') {
        staffType = 'pharmacist';
        designation = 'Chief Clinical Pharmacist';
        deptId = 1;
      } else if (u.role_name === 'accountant') {
        staffType = 'accountant';
        designation = 'Senior Revenue Billing Accountant';
        deptId = 1;
      } else if (u.role_name === 'hospital_admin' || u.role_name === 'super_admin') {
        staffType = 'admin';
        designation = u.role_name === 'super_admin' ? 'Chief Operations Executive' : 'Hospital Medical Administrator';
        deptId = 1;
      }

      const empId = `EMP-${new Date().getFullYear()}-${String(u.id).padStart(4, '0')}`;
      const joiningDate = '2025-01-15';

      await db.query(`
        INSERT INTO staff_profiles 
        (user_id, employee_id, department_id, designation, staff_type, joining_date, qualification, status)
        VALUES (?, ?, ?, ?, ?, ?, 'Board Certified Healthcare Professional', ?)
      `, [u.id, empId, deptId, designation, staffType, joiningDate, u.status === 'inactive' ? 'inactive' : 'active']);

      syncedCount++;
    }
  }

  console.log(`✅ Synchronized ${syncedCount} existing hospital staff user profiles.`);
  console.log('🎉 Hospital Staff Management Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migrateStaffModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateStaffModule;
