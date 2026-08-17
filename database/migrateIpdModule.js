const db = require('../server/config/db');

async function migrateIpdModule() {
  console.log('🏥 Starting Inpatient Department (IPD) & Admission Module Database Migration...');

  // 1. Check / Enhance wards table
  const [wCols] = await db.query('DESCRIBE wards');
  const wColNames = wCols.map(c => c.Field);

  if (!wColNames.includes('code')) {
    await db.query("ALTER TABLE wards ADD COLUMN code VARCHAR(30) NULL AFTER name");
  }
  if (!wColNames.includes('department_id')) {
    await db.query("ALTER TABLE wards ADD COLUMN department_id INT NULL AFTER id");
  }
  if (!wColNames.includes('ward_type')) {
    await db.query("ALTER TABLE wards ADD COLUMN ward_type ENUM('general', 'icu', 'ccu', 'surgical', 'pediatric', 'maternity', 'isolation', 'vip') DEFAULT 'general' AFTER code");
  }
  if (!wColNames.includes('gender_restriction')) {
    await db.query("ALTER TABLE wards ADD COLUMN gender_restriction ENUM('all', 'male_only', 'female_only', 'pediatric') DEFAULT 'all' AFTER floor_number");
  }
  if (!wColNames.includes('is_active')) {
    await db.query("ALTER TABLE wards ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER status");
  }

  // Update ward codes and types on existing wards
  await db.query(`
    UPDATE wards SET 
      code = CASE 
        WHEN id = 1 THEN 'ICU'
        WHEN id = 2 THEN 'CCU'
        WHEN id = 3 THEN 'PED-WARD'
        WHEN id = 4 THEN 'MAT-WARD'
        WHEN id = 5 THEN 'VIP-SUITE'
        WHEN id = 6 THEN 'EMERG-WARD'
        ELSE CONCAT('WARD-', id)
      END,
      ward_type = CASE 
        WHEN id = 1 THEN 'icu'
        WHEN id = 2 THEN 'ccu'
        WHEN id = 3 THEN 'pediatric'
        WHEN id = 4 THEN 'maternity'
        WHEN id = 5 THEN 'vip'
        WHEN id = 6 THEN 'surgical'
        ELSE 'general'
      END,
      department_id = CASE 
        WHEN id = 1 THEN 1
        WHEN id = 2 THEN 1
        WHEN id = 3 THEN 4
        WHEN id = 4 THEN 6
        WHEN id = 5 THEN 1
        WHEN id = 6 THEN 12
        ELSE 1
      END
  `);
  console.log('✅ Synchronized ward codes, types, and departments in MySQL.');

  // 2. Create rooms table
  await db.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ward_id INT NOT NULL,
      room_number VARCHAR(40) NOT NULL UNIQUE,
      room_type ENUM('general_shared', 'semi_private', 'private_single', 'icu_cubicle', 'isolation_negative_pressure', 'vip_deluxe') NOT NULL DEFAULT 'general_shared',
      floor_number INT NOT NULL DEFAULT 1,
      capacity_beds INT NOT NULL DEFAULT 2,
      daily_rate DECIMAL(10,2) NOT NULL DEFAULT 200.00,
      amenities TEXT NULL,
      status ENUM('active', 'cleaning', 'maintenance', 'inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE CASCADE,
      INDEX idx_room_ward (ward_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified rooms table in MySQL.');

  // Seed default rooms if empty
  const [existingRooms] = await db.query('SELECT COUNT(*) as count FROM rooms');
  if (existingRooms[0].count === 0) {
    await db.query(`
      INSERT INTO rooms (ward_id, room_number, room_type, floor_number, capacity_beds, daily_rate, amenities, status)
      VALUES
      (1, 'ICU-101', 'icu_cubicle', 2, 2, 450.00, 'Central Telemetry, Multi-Para Monitor, Ventilator Ready, Wall Suction', 'active'),
      (1, 'ICU-102', 'icu_cubicle', 2, 2, 450.00, 'Central Telemetry, Multi-Para Monitor, Ventilator Ready, Wall Suction', 'active'),
      (2, 'CCU-201', 'icu_cubicle', 2, 2, 400.00, '12-Lead Continuous ECG, Defibrillator Ready, Infusion Station', 'active'),
      (2, 'CCU-202', 'semi_private', 2, 2, 350.00, 'Cardiac Telemetry, Oxygen Port, Attached Bathroom', 'active'),
      (3, 'PED-301', 'private_single', 3, 1, 180.00, 'Pediatric Cot with Side Rails, Parent Sleeper Couch, Colorful Murals', 'active'),
      (3, 'PED-302', 'general_shared', 3, 4, 140.00, 'Pediatric Beds with Safety Enclosures, Play Area Access', 'active'),
      (4, 'MAT-401', 'private_single', 4, 1, 250.00, 'Neonatal Bassinet, Delivery-ready Fowler Bed, Private En-suite', 'active'),
      (5, 'VIP-501', 'vip_deluxe', 5, 1, 600.00, 'Executive Suite, King Bed, Living Room Lounge, 65-inch 4K TV, Dedicated Butler', 'active'),
      (6, 'EMERG-101', 'icu_cubicle', 1, 2, 300.00, 'Rapid Triage Crash Cart, Wall O2, Emergency Suction, Defibrillator', 'active')
    `);
    console.log('✅ Seeded 9 clinical inpatient rooms across wards.');
  }

  // 3. Create beds table
  await db.query(`
    CREATE TABLE IF NOT EXISTS beds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      room_id INT NOT NULL,
      ward_id INT NOT NULL,
      bed_number VARCHAR(40) NOT NULL UNIQUE,
      bed_type ENUM('standard_manual', 'electric_icu', 'fowler_bed', 'pediatric_cot', 'bariatric', 'delivery_bed') DEFAULT 'standard_manual',
      status ENUM('available', 'occupied', 'reserved', 'cleaning', 'maintenance') NOT NULL DEFAULT 'available',
      current_admission_id INT NULL,
      daily_rate DECIMAL(10,2) NOT NULL DEFAULT 100.00,
      features TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE CASCADE,
      INDEX idx_bed_ward (ward_id, status),
      INDEX idx_bed_room (room_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified beds table in MySQL.');

  // Seed default beds if empty
  const [existingBeds] = await db.query('SELECT COUNT(*) as count FROM beds');
  if (existingBeds[0].count === 0) {
    const [allRooms] = await db.query('SELECT id, room_number, ward_id FROM rooms');
    const roomMap = {};
    allRooms.forEach(r => { roomMap[r.room_number] = r; });

    const bedsData = [
      // ICU Room 101
      { room: 'ICU-101', num: 'BED-ICU-101A', type: 'electric_icu', status: 'available', rate: 150.00, feat: 'Hill-Rom Electric ICU Bed with integrated scales and emergency CPR release' },
      { room: 'ICU-101', num: 'BED-ICU-101B', type: 'electric_icu', status: 'available', rate: 150.00, feat: 'Hill-Rom Electric ICU Bed with integrated scales and emergency CPR release' },
      // ICU Room 102
      { room: 'ICU-102', num: 'BED-ICU-102A', type: 'electric_icu', status: 'available', rate: 150.00, feat: 'Hill-Rom Electric ICU Bed with integrated scales and emergency CPR release' },
      { room: 'ICU-102', num: 'BED-ICU-102B', type: 'electric_icu', status: 'available', rate: 150.00, feat: 'Hill-Rom Electric ICU Bed with integrated scales and emergency CPR release' },
      // CCU Room 201
      { room: 'CCU-201', num: 'BED-CCU-201A', type: 'electric_icu', status: 'available', rate: 140.00, feat: 'Cardiac telemetry linked Fowler bed with pressure relief mattress' },
      { room: 'CCU-201', num: 'BED-CCU-201B', type: 'electric_icu', status: 'available', rate: 140.00, feat: 'Cardiac telemetry linked Fowler bed with pressure relief mattress' },
      // CCU Room 202
      { room: 'CCU-202', num: 'BED-CCU-202A', type: 'fowler_bed', status: 'available', rate: 120.00, feat: '3-Function Fowler bed with side rails and IV pole mount' },
      { room: 'CCU-202', num: 'BED-CCU-202B', type: 'fowler_bed', status: 'available', rate: 120.00, feat: '3-Function Fowler bed with side rails and IV pole mount' },
      // Pediatric Room 301 & 302
      { room: 'PED-301', num: 'BED-PED-301A', type: 'pediatric_cot', status: 'available', rate: 90.00, feat: 'Safety lock transparent acrylic pediatric crib with adjustable height' },
      { room: 'PED-302', num: 'BED-PED-302A', type: 'pediatric_cot', status: 'available', rate: 80.00, feat: 'Pediatric bed with full side-rail protection' },
      { room: 'PED-302', num: 'BED-PED-302B', type: 'pediatric_cot', status: 'cleaning', rate: 80.00, feat: 'Pediatric bed with full side-rail protection' },
      // Maternity Room 401
      { room: 'MAT-401', num: 'BED-MAT-401A', type: 'delivery_bed', status: 'available', rate: 120.00, feat: 'Multi-position labor and birthing bed with leg supports' },
      // VIP Room 501
      { room: 'VIP-501', num: 'BED-VIP-501A', type: 'electric_icu', status: 'available', rate: 300.00, feat: 'Luxury bariatric electric bed with massage functions and wireless remote' },
      // Emergency Room 101
      { room: 'EMERG-101', num: 'BED-EMERG-101A', type: 'electric_icu', status: 'available', rate: 100.00, feat: 'Emergency trauma stretcher bed with hydraulic tilt' },
      { room: 'EMERG-101', num: 'BED-EMERG-101B', type: 'electric_icu', status: 'maintenance', rate: 100.00, feat: 'Emergency trauma stretcher bed with hydraulic tilt' }
    ];

    for (const b of bedsData) {
      const r = roomMap[b.room];
      if (r) {
        await db.query(
          `INSERT INTO beds (room_id, ward_id, bed_number, bed_type, status, daily_rate, features)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [r.id, r.ward_id, b.num, b.type, b.status, b.rate, b.feat]
        );
      }
    }
    console.log('✅ Seeded 15 realistic inpatient hospital beds across all wards and rooms.');
  }

  // 4. Create ipd_admissions table
  await db.query(`
    CREATE TABLE IF NOT EXISTS ipd_admissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admission_number VARCHAR(40) NOT NULL UNIQUE,
      patient_id INT NOT NULL,
      doctor_id INT NOT NULL,
      department_id INT NOT NULL,
      ward_id INT NOT NULL,
      room_id INT NOT NULL,
      bed_id INT NOT NULL,
      primary_nurse_id INT NULL,
      admission_date DATETIME NOT NULL,
      admission_type ENUM('emergency', 'elective_planned', 'transfer_in', 'post_op') DEFAULT 'elective_planned',
      admitting_diagnosis TEXT NOT NULL,
      chief_complaint TEXT NULL,
      initial_vitals_id INT NULL,
      emergency_contact_name VARCHAR(100) NULL,
      emergency_contact_phone VARCHAR(30) NULL,
      emergency_contact_relation VARCHAR(50) NULL,
      insurance_provider VARCHAR(100) NULL,
      insurance_policy_number VARCHAR(80) NULL,
      status ENUM('admitted', 'under_treatment', 'transferred', 'discharge_requested', 'discharged', 'cancelled') DEFAULT 'admitted',
      discharge_date DATETIME NULL,
      discharge_type ENUM('routine_recovered', 'referred_transfer', 'against_medical_advice', 'deceased') NULL,
      discharge_summary LONGTEXT NULL,
      final_diagnosis TEXT NULL,
      discharge_advice TEXT NULL,
      follow_up_date DATE NULL,
      discharged_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE CASCADE,
      FOREIGN KEY (primary_nurse_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (discharged_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_ipd_patient (patient_id, admission_date DESC),
      INDEX idx_ipd_status (status),
      INDEX idx_ipd_bed (bed_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified ipd_admissions table in MySQL.');

  // 5. Create ipd_patient_transfers table
  await db.query(`
    CREATE TABLE IF NOT EXISTS ipd_patient_transfers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transfer_number VARCHAR(40) NOT NULL UNIQUE,
      admission_id INT NOT NULL,
      patient_id INT NOT NULL,
      from_ward_id INT NOT NULL,
      from_room_id INT NOT NULL,
      from_bed_id INT NOT NULL,
      to_ward_id INT NOT NULL,
      to_room_id INT NOT NULL,
      to_bed_id INT NOT NULL,
      transfer_reason TEXT NOT NULL,
      transfer_date DATETIME NOT NULL,
      transferred_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admission_id) REFERENCES ipd_admissions(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (from_ward_id) REFERENCES wards(id) ON DELETE CASCADE,
      FOREIGN KEY (from_room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (from_bed_id) REFERENCES beds(id) ON DELETE CASCADE,
      FOREIGN KEY (to_ward_id) REFERENCES wards(id) ON DELETE CASCADE,
      FOREIGN KEY (to_room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (to_bed_id) REFERENCES beds(id) ON DELETE CASCADE,
      FOREIGN KEY (transferred_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_trf_adm (admission_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified ipd_patient_transfers table in MySQL.');

  // 6. Create ipd_daily_rounds table
  await db.query(`
    CREATE TABLE IF NOT EXISTS ipd_daily_rounds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admission_id INT NOT NULL,
      doctor_id INT NOT NULL,
      round_date DATETIME NOT NULL,
      progress_notes LONGTEXT NOT NULL,
      treatment_plan TEXT NOT NULL,
      nursing_instructions TEXT NULL,
      vitals_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admission_id) REFERENCES ipd_admissions(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      INDEX idx_rnd_adm (admission_id, round_date DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified ipd_daily_rounds table in MySQL.');

  // Seed sample active admission if empty
  const [existingAdmissions] = await db.query('SELECT COUNT(*) as count FROM ipd_admissions');
  if (existingAdmissions[0].count === 0) {
    console.log('Seeding initial active inpatient admission...');

    const [ccuBed] = await db.query("SELECT id, room_id, ward_id FROM beds WHERE bed_number = 'BED-CCU-201A' LIMIT 1");
    if (ccuBed.length > 0) {
      const b = ccuBed[0];
      const [admRes] = await db.query(`
        INSERT INTO ipd_admissions 
        (admission_number, patient_id, doctor_id, department_id, ward_id, room_id, bed_id, admission_date, admission_type, admitting_diagnosis, chief_complaint, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, insurance_provider, insurance_policy_number, status)
        VALUES 
        ('IPD-2026-000101', 1, 1, 1, ${b.ward_id}, ${b.room_id}, ${b.id}, DATE_SUB(NOW(), INTERVAL 2 DAY), 'elective_planned', 'Post-Coronary Artery Bypass Graft (CABG) 48-Hour Critical Telemetry Surveillance', 'Mild exertional dyspnea and routine post-op telemetry check.', 'Eleanor Pendleton', '555-0199', 'Spouse', 'BlueCross BlueShield Premier', 'BCBS-POL-88992', 'admitted')
      `);

      const admId = admRes.insertId;

      // Set Bed to occupied
      await db.query(`
        UPDATE beds 
        SET status = 'occupied', current_admission_id = ${admId} 
        WHERE id = ${b.id}
      `);

      // Update total_beds & occupied_beds for all wards
      await db.query(`
        UPDATE wards w
        SET total_beds = (SELECT COUNT(*) FROM beds WHERE ward_id = w.id),
            occupied_beds = (SELECT COUNT(*) FROM beds WHERE ward_id = w.id AND status = 'occupied')
      `);

      // Add daily clinical round note
      await db.query(`
        INSERT INTO ipd_daily_rounds 
        (admission_id, doctor_id, round_date, progress_notes, treatment_plan, nursing_instructions)
        VALUES 
        (${admId}, 1, DATE_SUB(NOW(), INTERVAL 1 DAY), 
         'Patient is alert, oriented x 3. Vital signs stable: BP 122/78 mmHg, HR 72 bpm sinus rhythm on continuous telemetry, SpO2 98% on room air. Median sternotomy wound clean and dry.',
         'Continue Atorvastatin 20mg daily, Metoprolol 50mg BID, Low-dose Aspirin 81mg. Gradual bedside ambulation with physical therapy.',
         'Maintain continuous 12-lead ECG telemetry monitoring. Record hourly urine output and twice-daily wound inspection.')
      `);

      console.log('✅ Seeded active inpatient admission, occupied bed, and clinical daily round.');
    }
  }

  console.log('🎉 Inpatient Department (IPD) & Admission Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migrateIpdModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateIpdModule;
