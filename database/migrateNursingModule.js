const db = require('../server/config/db');

async function migrateNursingModule() {
  console.log('🩺 Starting Nursing Management Module Database Migration...');

  // Ensure nurse users exist
  const [existingNurses] = await db.query('SELECT COUNT(*) as count FROM users WHERE role_id = 5');
  if (existingNurses[0].count < 3) {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('Nurse@123', 10);

    await db.query(`
      INSERT INTO users (role_id, full_name, email, password_hash, phone, status)
      VALUES
      (5, 'Nurse Sarah Jenkins (ICU Charge Nurse)', 'sarah.jenkins@auracare.com', '${hash}', '+1 (555) 234-5678', 'active'),
      (5, 'Nurse David Rivera (Cardiac Care Specialist)', 'david.rivera@auracare.com', '${hash}', '+1 (555) 345-6789', 'active')
      ON DUPLICATE KEY UPDATE full_name=VALUES(full_name)
    `);
    console.log('✅ Seeded dedicated clinical nurse accounts.');
  }

  // 1. Create nurse_ward_assignments table
  await db.query(`
    CREATE TABLE IF NOT EXISTS nurse_ward_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nurse_id INT NOT NULL,
      ward_id INT NOT NULL,
      shift_type ENUM('morning', 'evening', 'night', 'rotating') DEFAULT 'morning',
      is_primary TINYINT(1) DEFAULT 1,
      assigned_date DATE NOT NULL,
      status ENUM('active', 'inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (nurse_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE CASCADE,
      INDEX idx_nwa_nurse (nurse_id, status),
      INDEX idx_nwa_ward (ward_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified nurse_ward_assignments table in MySQL.');

  // Seed default nurse ward assignments
  const [existingNwa] = await db.query('SELECT COUNT(*) as count FROM nurse_ward_assignments');
  if (existingNwa[0].count === 0) {
    const [nurses] = await db.query('SELECT id FROM users WHERE role_id = 5 ORDER BY id ASC');
    const [wards] = await db.query('SELECT id FROM wards ORDER BY id ASC');

    if (nurses.length > 0 && wards.length > 0) {
      for (let i = 0; i < nurses.length; i++) {
        const wardId = wards[i % wards.length].id;
        await db.query(`
          INSERT INTO nurse_ward_assignments (nurse_id, ward_id, shift_type, is_primary, assigned_date, status)
          VALUES (${nurses[i].id}, ${wardId}, 'morning', 1, CURDATE(), 'active')
        `);
        // Also assign to CCU / ICU for coverage
        if (wards.length > 1) {
          await db.query(`
            INSERT INTO nurse_ward_assignments (nurse_id, ward_id, shift_type, is_primary, assigned_date, status)
            VALUES (${nurses[i].id}, ${wards[(i + 1) % wards.length].id}, 'morning', 0, CURDATE(), 'active')
          `);
        }
      }
      console.log('✅ Seeded nurse-ward duty assignments.');
    }
  }

  // 2. Create nursing_notes table
  await db.query(`
    CREATE TABLE IF NOT EXISTS nursing_notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      note_number VARCHAR(40) NOT NULL UNIQUE,
      patient_id INT NOT NULL,
      admission_id INT NULL,
      nurse_id INT NOT NULL,
      note_type ENUM('shift_handover', 'progress_note', 'incident_report', 'wound_care', 'intake_output', 'triage_assessment', 'doctor_instruction_acknowledgment') NOT NULL,
      priority_level ENUM('stable', 'moderate', 'high_attention', 'critical') DEFAULT 'stable',
      subjective_observation TEXT NULL,
      objective_findings TEXT NULL,
      nursing_interventions TEXT NOT NULL,
      patient_response TEXT NULL,
      care_plan_instructions TEXT NULL,
      intake_ml INT NULL,
      output_ml INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (admission_id) REFERENCES ipd_admissions(id) ON DELETE SET NULL,
      FOREIGN KEY (nurse_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_nn_patient (patient_id, created_at DESC),
      INDEX idx_nn_adm (admission_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified nursing_notes table in MySQL.');

  // 3. Create nursing_medication_administrations table (eMAR)
  await db.query(`
    CREATE TABLE IF NOT EXISTS nursing_medication_administrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      administration_number VARCHAR(40) NOT NULL UNIQUE,
      patient_id INT NOT NULL,
      admission_id INT NULL,
      prescription_item_id INT NULL,
      medicine_name VARCHAR(150) NOT NULL,
      dosage VARCHAR(60) NOT NULL,
      route ENUM('oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'rectal', 'sublingual') NOT NULL DEFAULT 'oral',
      scheduled_time DATETIME NOT NULL,
      administered_time DATETIME NOT NULL,
      nurse_id INT NOT NULL,
      status ENUM('administered', 'held', 'refused', 'delayed', 'missed') DEFAULT 'administered',
      reason_notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (admission_id) REFERENCES ipd_admissions(id) ON DELETE SET NULL,
      FOREIGN KEY (prescription_item_id) REFERENCES prescription_items(id) ON DELETE SET NULL,
      FOREIGN KEY (nurse_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_emar_patient (patient_id, administered_time DESC),
      INDEX idx_emar_adm (admission_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified nursing_medication_administrations table in MySQL.');

  // 4. Create nursing_ward_tasks table
  await db.query(`
    CREATE TABLE IF NOT EXISTS nursing_ward_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_number VARCHAR(40) NOT NULL UNIQUE,
      patient_id INT NOT NULL,
      admission_id INT NULL,
      ward_id INT NOT NULL,
      bed_id INT NULL,
      task_type ENUM('vitals_check', 'medication_due', 'wound_dressing', 'iv_cannula_change', 'catheter_care', 'blood_draw', 'specimen_collection', 'physiotherapy_assist', 'doctor_order') NOT NULL,
      description TEXT NOT NULL,
      priority ENUM('urgent_critical', 'high', 'medium', 'routine') DEFAULT 'medium',
      due_time DATETIME NOT NULL,
      assigned_nurse_id INT NULL,
      status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
      completed_at DATETIME NULL,
      completed_by INT NULL,
      completion_notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (admission_id) REFERENCES ipd_admissions(id) ON DELETE SET NULL,
      FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE CASCADE,
      FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_nurse_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_nwt_ward (ward_id, status),
      INDEX idx_nwt_due (due_time ASC),
      INDEX idx_nwt_patient (patient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified nursing_ward_tasks table in MySQL.');

  // Seed sample clinical nursing data if empty
  const [existingNotes] = await db.query('SELECT COUNT(*) as count FROM nursing_notes');
  if (existingNotes[0].count === 0) {
    const [nurse] = await db.query('SELECT id FROM users WHERE role_id = 5 LIMIT 1');
    const nurseId = nurse.length > 0 ? nurse[0].id : 6;

    const [adm] = await db.query("SELECT id, patient_id, ward_id, bed_id FROM ipd_admissions WHERE status = 'admitted' LIMIT 1");
    const admissionId = adm.length > 0 ? adm[0].id : null;
    const patientId = adm.length > 0 ? adm[0].patient_id : 1;
    const wardId = adm.length > 0 ? adm[0].ward_id : 2;
    const bedId = adm.length > 0 ? adm[0].bed_id : 5;

    // Seed nursing shift progress note
    await db.query(`
      INSERT INTO nursing_notes 
      (note_number, patient_id, admission_id, nurse_id, note_type, priority_level, subjective_observation, objective_findings, nursing_interventions, patient_response, care_plan_instructions, intake_ml, output_ml)
      VALUES 
      ('NOT-2026-000101', ${patientId}, ${admissionId ? admissionId : 'NULL'}, ${nurseId}, 'shift_handover', 'moderate', 
       'Patient reports mild fatigue but denies chest pain or shortness of breath.',
       'BP 124/80 mmHg, HR 74 bpm regular sinus rhythm on telemetry. Surgical sternotomy incision clean, dry, intact with no erythema or drainage. Peripheral pulses +2 bilaterally.',
       'Assisted with morning hygiene and bedside ambulation x 50 feet. Administered morning scheduled cardiac medications. Telemetry monitoring continued.',
       'Patient tolerated ambulation well with SpO2 remaining at 98% on room air.',
       'Encourage incentive spirometry 10 breaths/hour while awake. Maintain low-sodium cardiac diet.',
       1200, 1050)
    `);

    // Seed eMAR medication administration
    await db.query(`
      INSERT INTO nursing_medication_administrations 
      (administration_number, patient_id, admission_id, medicine_name, dosage, route, scheduled_time, administered_time, nurse_id, status, reason_notes)
      VALUES 
      ('MAR-2026-000101', ${patientId}, ${admissionId ? admissionId : 'NULL'}, 'Metoprolol Tartrate', '50mg', 'oral', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR), ${nurseId}, 'administered', 'Given with breakfast. Pre-dose HR 76, BP 126/82.'),
      ('MAR-2026-000102', ${patientId}, ${admissionId ? admissionId : 'NULL'}, 'Atorvastatin Calcium', '20mg', 'oral', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR), ${nurseId}, 'administered', 'Taken with water. Tolerated well without GI distress.')
    `);

    // Seed ward nursing tasks
    await db.query(`
      INSERT INTO nursing_ward_tasks 
      (task_number, patient_id, admission_id, ward_id, bed_id, task_type, description, priority, due_time, assigned_nurse_id, status)
      VALUES 
      ('TSK-2026-000101', ${patientId}, ${admissionId ? admissionId : 'NULL'}, ${wardId}, ${bedId ? bedId : 'NULL'}, 'vitals_check', '4-Hour Comprehensive Vital Signs & SpO2 Telemetry Charting', 'high', DATE_ADD(NOW(), INTERVAL 2 HOUR), ${nurseId}, 'pending'),
      ('TSK-2026-000102', ${patientId}, ${admissionId ? admissionId : 'NULL'}, ${wardId}, ${bedId ? bedId : 'NULL'}, 'medication_due', 'Evening Dose Metoprolol 50mg PO', 'medium', DATE_ADD(NOW(), INTERVAL 6 HOUR), ${nurseId}, 'pending'),
      ('TSK-2026-000103', ${patientId}, ${admissionId ? admissionId : 'NULL'}, ${wardId}, ${bedId ? bedId : 'NULL'}, 'wound_dressing', 'Daily Sterile Surgical Incision Inspection & Antiseptic Swab', 'routine', DATE_ADD(NOW(), INTERVAL 4 HOUR), ${nurseId}, 'pending')
    `);

    console.log('✅ Seeded initial clinical nursing notes, eMAR records, and ward tasks.');
  }

  console.log('🎉 Nursing Management Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migrateNursingModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateNursingModule;
