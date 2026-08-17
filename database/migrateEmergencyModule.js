const db = require('../server/config/db');

async function migrateEmergencyModule() {
  console.log('🚨 Starting Emergency Department Module Database Migration...');

  // 1. Ensure Emergency Ward, Rooms, and Beds exist
  const [erWardRows] = await db.query("SELECT id FROM wards WHERE code = 'EM-TRAUMA' OR name LIKE '%Emergency%' LIMIT 1");
  let erWardId = null;

  if (erWardRows.length === 0) {
    const [deptRows] = await db.query("SELECT id FROM departments WHERE code = 'EMERG' OR name LIKE '%Emergency%' LIMIT 1");
    const deptId = deptRows.length > 0 ? deptRows[0].id : 12;

    const [wardRes] = await db.query(`
      INSERT INTO wards (department_id, name, code, ward_type, floor_number, gender_restriction, total_beds, occupied_beds, price_per_day, status, is_active)
      VALUES (${deptId}, 'Emergency & Trauma Care Center', 'EM-TRAUMA', 'emergency', 1, 'none', 6, 0, 150.00, 'active', 1)
    `);
    erWardId = wardRes.insertId;
    console.log('✅ Created Emergency & Trauma Care Center ward.');
  } else {
    erWardId = erWardRows[0].id;
  }

  // Ensure ER Rooms exist
  const [erRoomRows] = await db.query("SELECT id FROM rooms WHERE ward_id = ? LIMIT 1", [erWardId]);
  let erRoomId = null;

  if (erRoomRows.length === 0) {
    const [rRes1] = await db.query(`
      INSERT INTO rooms (ward_id, room_number, room_type, floor_number, capacity_beds, daily_rate, amenities, status)
      VALUES 
      (${erWardId}, 'ER-BAY-101', 'icu_cubicle', 1, 2, 200.00, 'Cardiac Defibrillator, Continuous 12-Lead Telemetry, High-Flow O2, Crash Cart', 'available'),
      (${erWardId}, 'ER-RESUS-1', 'icu_cubicle', 1, 2, 350.00, 'Rapid Infuser, Mechanical Ventilator, Suture Tray, Video Laryngoscope', 'available'),
      (${erWardId}, 'ER-OBS-102', 'general_shared', 1, 2, 120.00, 'Vital Signs Monitor, Suction, Oxygen Port, Reclining Medical Bed', 'available')
    `);
    erRoomId = rRes1.insertId;

    // Seed ER Beds
    await db.query(`
      INSERT INTO beds (room_id, ward_id, bed_number, bed_type, status, daily_rate, features, is_active)
      VALUES
      (${erRoomId}, ${erWardId}, 'BED-ER-101A', 'electric_icu', 'available', 200.00, 'Multi-parameter Telemetry & Emergency Cardiac Port', 1),
      (${erRoomId}, ${erWardId}, 'BED-ER-101B', 'electric_icu', 'available', 200.00, 'Multi-parameter Telemetry & Emergency Cardiac Port', 1),
      (${erRoomId + 1}, ${erWardId}, 'BED-ER-RESUS-1', 'electric_icu', 'available', 350.00, 'Level 1 Trauma & Resuscitation Life Support Bed', 1),
      (${erRoomId + 1}, ${erWardId}, 'BED-ER-RESUS-2', 'electric_icu', 'available', 350.00, 'Level 1 Trauma & Resuscitation Life Support Bed', 1),
      (${erRoomId + 2}, ${erWardId}, 'BED-ER-OBS-01', 'fowler_bed', 'available', 120.00, 'Short-stay Emergency Observation Bed', 1),
      (${erRoomId + 2}, ${erWardId}, 'BED-ER-OBS-02', 'fowler_bed', 'available', 120.00, 'Short-stay Emergency Observation Bed', 1)
      ON DUPLICATE KEY UPDATE status=VALUES(status)
    `);
    console.log('✅ Seeded 3 dedicated ER rooms and 6 emergency beds.');
  }

  // 2. Create emergency_visits table
  await db.query(`
    CREATE TABLE IF NOT EXISTS emergency_visits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      emergency_number VARCHAR(40) NOT NULL UNIQUE,
      patient_id INT NOT NULL,
      triage_nurse_id INT NULL,
      attending_doctor_id INT NULL,
      ward_id INT NULL,
      room_id INT NULL,
      bed_id INT NULL,
      arrival_time DATETIME NOT NULL,
      arrival_mode ENUM('ambulance', 'walk_in', 'helicopter', 'wheelchair', 'police_referral') NOT NULL DEFAULT 'walk_in',
      is_trauma TINYINT(1) DEFAULT 0,
      chief_complaint TEXT NOT NULL,
      initial_triage_assessment TEXT NULL,
      triage_acuity_score ENUM('1', '2', '3', '4', '5') DEFAULT '3',
      priority ENUM('critical', 'high', 'medium', 'low') NOT NULL DEFAULT 'medium',
      glasgow_coma_scale INT NULL,
      pain_scale INT NULL,
      status ENUM('triage_pending', 'under_treatment', 'observation', 'admitted_ipd', 'transferred', 'discharged', 'deceased') NOT NULL DEFAULT 'triage_pending',
      discharge_admission_date DATETIME NULL,
      discharge_disposition ENUM('home', 'ipd_admission', 'icu_transfer', 'ot_surgery', 'external_transfer', 'ama_left_against_medical_advice', 'deceased') NULL,
      ipd_admission_id INT NULL,
      discharge_summary TEXT NULL,
      transfer_facility_name VARCHAR(150) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (triage_nurse_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (attending_doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
      FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE SET NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
      FOREIGN KEY (bed_id) REFERENCES beds(id) ON DELETE SET NULL,
      FOREIGN KEY (ipd_admission_id) REFERENCES ipd_admissions(id) ON DELETE SET NULL,
      INDEX idx_er_priority (priority),
      INDEX idx_er_status (status),
      INDEX idx_er_patient (patient_id),
      INDEX idx_er_arrival (arrival_time DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified emergency_visits table in MySQL.');

  // 3. Create emergency_clinical_notes table
  await db.query(`
    CREATE TABLE IF NOT EXISTS emergency_clinical_notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      note_number VARCHAR(40) NOT NULL UNIQUE,
      emergency_visit_id INT NOT NULL,
      patient_id INT NOT NULL,
      doctor_id INT NULL,
      nurse_id INT NULL,
      note_type ENUM('triage_note', 'primary_survey', 'secondary_survey', 'physician_assessment', 'resuscitation_note', 'procedure_note', 'discharge_summary') NOT NULL,
      primary_survey_airway VARCHAR(100) NULL,
      primary_survey_breathing VARCHAR(100) NULL,
      primary_survey_circulation VARCHAR(100) NULL,
      primary_survey_disability VARCHAR(100) NULL,
      primary_survey_exposure VARCHAR(100) NULL,
      clinical_findings TEXT NOT NULL,
      treatment_orders TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (emergency_visit_id) REFERENCES emergency_visits(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
      FOREIGN KEY (nurse_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_ecn_visit (emergency_visit_id),
      INDEX idx_ecn_patient (patient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified emergency_clinical_notes table in MySQL.');

  // 4. Create emergency_treatments table
  await db.query(`
    CREATE TABLE IF NOT EXISTS emergency_treatments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      treatment_number VARCHAR(40) NOT NULL UNIQUE,
      emergency_visit_id INT NOT NULL,
      patient_id INT NOT NULL,
      treatment_type ENUM('medication', 'iv_fluid', 'oxygen_therapy', 'wound_care_suture', 'cardiac_defibrillation', 'cpr_resuscitation', 'splinting', 'intubation', 'diagnostic_order') NOT NULL,
      description TEXT NOT NULL,
      dosage_spec VARCHAR(100) NULL,
      administered_by INT NULL,
      administered_time DATETIME NOT NULL,
      patient_response TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (emergency_visit_id) REFERENCES emergency_visits(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (administered_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_et_visit (emergency_visit_id),
      INDEX idx_et_patient (patient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);
  console.log('✅ Verified emergency_treatments table in MySQL.');

  // Seed sample emergency encounters if empty
  const [existingEv] = await db.query('SELECT COUNT(*) as count FROM emergency_visits');
  if (existingEv[0].count === 0) {
    const [bed] = await db.query("SELECT id, room_id, ward_id FROM beds WHERE bed_number LIKE 'BED-ER%' LIMIT 1");
    const bedId = bed.length > 0 ? bed[0].id : null;
    const roomId = bed.length > 0 ? bed[0].room_id : null;
    const wardId = bed.length > 0 ? bed[0].ward_id : erWardId;

    // 1. Critical Chest Pain Emergency
    const [res1] = await db.query(`
      INSERT INTO emergency_visits 
      (emergency_number, patient_id, triage_nurse_id, attending_doctor_id, ward_id, room_id, bed_id, arrival_time, arrival_mode, is_trauma, chief_complaint, initial_triage_assessment, triage_acuity_score, priority, glasgow_coma_scale, pain_scale, status)
      VALUES 
      ('ER-2026-000101', 1, 6, 1, ${wardId ? wardId : 'NULL'}, ${roomId ? roomId : 'NULL'}, ${bedId ? bedId : 'NULL'}, NOW(), 'ambulance', 0, 
       'Acute crushing retrosternal chest pain radiating to left arm with diaphoresis and dyspnea',
       'STEMI Alert activated. Cold, clammy, tachycardic. 12-lead ECG shows 3mm ST elevation in leads V1-V4.',
       '1', 'critical', 15, 9, 'under_treatment')
    `);
    const erId1 = res1.insertId;

    // Mark bed occupied
    if (bedId) {
      await db.query(`UPDATE beds SET status = 'occupied' WHERE id = ${bedId}`);
    }

    // Seed emergency primary survey note
    await db.query(`
      INSERT INTO emergency_clinical_notes 
      (note_number, emergency_visit_id, patient_id, doctor_id, nurse_id, note_type, primary_survey_airway, primary_survey_breathing, primary_survey_circulation, primary_survey_disability, primary_survey_exposure, clinical_findings, treatment_orders)
      VALUES 
      ('ERN-2026-000101', ${erId1}, 1, 1, 6, 'primary_survey',
       'Patent, non-obstructed', 'Tachypneic at 24/min, bilateral crackles at lung bases', 'Pulse 110 bpm regular, BP 160/95 mmHg, peripheral pulses palpable', 'GCS 15/15, pupils equal and reactive', 'Afebrile, diaphoresis noted',
       'High suspicion for Acute Anterior Wall Myocardial Infarction. Urgent Cath Lab activation requested.',
       'Oxygen via nasal cannula 4L/min, Chewable Aspirin 325mg PO, Sublingual Nitroglycerin 0.4mg, IV Access 18G left forearm, STAT Troponin-I and Cardiac Panel.')
    `);

    // Seed emergency treatments
    await db.query(`
      INSERT INTO emergency_treatments 
      (treatment_number, emergency_visit_id, patient_id, treatment_type, description, dosage_spec, administered_by, administered_time, patient_response)
      VALUES 
      ('ERT-2026-000101', ${erId1}, 1, 'medication', 'Aspirin (Chewable)', '325mg Oral STAT', 6, NOW(), 'Chewed and swallowed without difficulty.'),
      ('ERT-2026-000102', ${erId1}, 1, 'oxygen_therapy', 'High-Flow Supplemental Oxygen', '4 L/min Nasal Cannula', 6, NOW(), 'SpO2 improved from 91% to 98%.'),
      ('ERT-2026-000103', ${erId1}, 1, 'iv_fluid', 'Normal Saline (0.9% NaCl) IV Infusion', '100 mL/hr via 18G line', 6, NOW(), 'IV running smoothly, no infiltration.')
    `);

    console.log('✅ Seeded initial emergency patient encounter, clinical notes, and treatments.');
  }

  console.log('🎉 Emergency Department Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migrateEmergencyModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateEmergencyModule;
