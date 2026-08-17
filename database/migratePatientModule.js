const db = require('../server/config/db');
const bcrypt = require('bcryptjs');

async function migrateAndSeedPatientModule() {
  console.log('🚀 [PATIENT MODULE MIGRATION] Starting database schema upgrade and comprehensive seeding...');

  // 1. Ensure columns exist in `patients` table
  const columnsToAdd = [
    { name: 'identification_number', type: 'VARCHAR(50) NULL', after: 'email' },
    { name: 'emergency_contact_relation', type: 'VARCHAR(50) NULL', after: 'emergency_contact_phone' },
    { name: 'allergies', type: 'TEXT NULL', after: 'emergency_contact_relation' },
    { name: 'medical_history', type: 'TEXT NULL', after: 'allergies' },
    { name: 'registration_date', type: 'DATE NULL', after: 'medical_history' },
    { name: 'status', type: "ENUM('active', 'inactive', 'deceased', 'suspended') DEFAULT 'active'", after: 'registration_date' },
    { name: 'profile_image', type: 'VARCHAR(255) NULL', after: 'status' },
    { name: 'marital_status', type: "ENUM('single', 'married', 'divorced', 'widowed', 'other') DEFAULT 'single'", after: 'profile_image' },
    { name: 'occupation', type: 'VARCHAR(100) NULL', after: 'marital_status' },
    { name: 'insurance_provider', type: 'VARCHAR(100) NULL', after: 'occupation' },
    { name: 'insurance_policy_number', type: 'VARCHAR(100) NULL', after: 'insurance_provider' }
  ];

  for (const col of columnsToAdd) {
    try {
      const [check] = await db.query(
        `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'patients' AND COLUMN_NAME = ?`,
        [col.name]
      );
      if (check[0].cnt === 0) {
        console.log(`Adding column '${col.name}' to patients table...`);
        await db.query(`ALTER TABLE patients ADD COLUMN ${col.name} ${col.type}`);
      }
    } catch (err) {
      console.warn(`Column check/add notice for ${col.name}:`, err.message);
    }
  }

  // 2. Ensure patient_documents table and all columns exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS patient_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      document_name VARCHAR(200) NOT NULL,
      document_type VARCHAR(60) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      file_size_kb INT DEFAULT 150,
      uploaded_by INT NULL,
      notes TEXT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      INDEX idx_doc_patient (patient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  try {
    await db.query('ALTER TABLE patient_documents ADD COLUMN file_size_kb INT DEFAULT 150');
  } catch (_) {}
  try {
    await db.query('ALTER TABLE patient_documents ADD COLUMN notes TEXT NULL');
  } catch (_) {}

  // 3. Ensure vitals table and all columns exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS vitals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      recorded_by INT NULL,
      systolic INT NULL,
      diastolic INT NULL,
      heart_rate INT NULL,
      temperature DECIMAL(4,1) NULL,
      respiratory_rate INT NULL,
      oxygen_saturation INT NULL,
      blood_sugar INT NULL,
      weight_kg DECIMAL(5,2) NULL,
      height_cm DECIMAL(5,2) NULL,
      bmi DECIMAL(4,1) NULL,
      notes TEXT NULL,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      INDEX idx_vitals_patient (patient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  try {
    await db.query('ALTER TABLE vitals ADD COLUMN recorded_by INT NULL');
  } catch (_) {}
  try {
    await db.query('ALTER TABLE vitals ADD COLUMN bmi DECIMAL(4,1) NULL');
  } catch (_) {}

  // 4. Ensure lab_tests and lab_orders tables exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS lab_tests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      code VARCHAR(30) NOT NULL UNIQUE,
      category VARCHAR(80) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 40.00,
      turnaround_hours INT DEFAULT 24,
      normal_range VARCHAR(100),
      unit VARCHAR(30),
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS lab_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_number VARCHAR(30) NOT NULL UNIQUE,
      patient_id INT NOT NULL,
      doctor_id INT NOT NULL,
      test_id INT NOT NULL,
      order_date DATE NOT NULL,
      sample_type VARCHAR(60),
      sample_collected_at DATETIME NULL,
      result_value VARCHAR(100) NULL,
      result_notes TEXT NULL,
      status ENUM('ordered', 'sample_collected', 'in_progress', 'completed', 'cancelled') DEFAULT 'ordered',
      completed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      FOREIGN KEY (test_id) REFERENCES lab_tests(id) ON DELETE CASCADE,
      INDEX idx_lab_pat (patient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 5. Ensure Departments exist
  const [deptCount] = await db.query('SELECT COUNT(*) as count FROM departments');
  if (deptCount[0].count === 0) {
    console.log('Seeding clinical departments...');
    await db.query(`
      INSERT INTO departments (id, name, code, description, icon, is_active) VALUES
      (1, 'Cardiology', 'CARD', 'Comprehensive cardiovascular medicine and coronary care', 'fa-heart-pulse', 1),
      (2, 'Neurology', 'NEUR', 'Advanced brain, spine and nervous system diagnostics', 'fa-brain', 1),
      (3, 'Pediatrics', 'PED', 'Specialized infant, child and adolescent health', 'fa-baby', 1),
      (4, 'Orthopedics', 'ORTH', 'Bone, joint, musculoskeletal reconstructive surgery', 'fa-bone', 1),
      (5, 'General Internal Medicine', 'GEN', 'Primary care, chronic disease triage and preventative wellness', 'fa-stethoscope', 1),
      (6, 'Dermatology', 'DERM', 'Clinical skin pathology, laser therapies and allergy testing', 'fa-hand-dots', 1),
      (7, 'Emergency & Trauma', 'ER', '24/7 Acute critical resuscitation and emergent trauma intervention', 'fa-truck-medical', 1),
      (8, 'Endocrinology', 'ENDO', 'Diabetes management, metabolic and hormonal disorders', 'fa-dna', 1)
      ON DUPLICATE KEY UPDATE name = VALUES(name);
    `);
  }

  // 6. Ensure Doctors exist
  const [docCount] = await db.query('SELECT COUNT(*) as count FROM doctors');
  if (docCount[0].count === 0) {
    console.log('Seeding doctors and specialists...');
    // Doctor user 3: Dr. Marcus Vance, Doctor user 4: Dr. Elena Rostova
    await db.query(`
      INSERT INTO doctors (id, user_id, department_id, specialization, qualification, experience_years, consultation_fee, bio, room_number, is_available) VALUES
      (1, 3, 1, 'Senior Interventional Cardiologist', 'MD, FACC, FSCAI (Johns Hopkins)', 14, 120.00, 'Board-certified cardiologist specializing in coronary artery disease, lipidology, and echocardiography.', 'Suite 302-A', 1),
      (2, 4, 2, 'Consultant Neurologist', 'MD, PhD, FAAN (Harvard Medical)', 11, 140.00, 'Specialist in migraine management, neuro-imaging, neuromuscular disorders, and electroencephalography.', 'Suite 405-B', 1)
      ON DUPLICATE KEY UPDATE specialization = VALUES(specialization);
    `);
  }

  // 7. Seed Patients
  const [patCount] = await db.query('SELECT COUNT(*) as count FROM patients');
  console.log(`Current patients count: ${patCount[0].count}`);

  if (patCount[0].count < 5) {
    console.log('Seeding rich patient directory...');
    const salt = await bcrypt.genSalt(10);
    const demoPasswordHash = await bcrypt.hash('Clinic2026!', salt);

    // Make sure Arthur Pendleton (user_id 10) is linked properly as Patient 1
    const patientsData = [
      {
        userId: 10,
        patientCode: 'PAT-2026-0001',
        firstName: 'Arthur',
        lastName: 'Pendleton',
        gender: 'male',
        dateOfBirth: '1984-06-15',
        bloodGroup: 'O+',
        phone: '+1 (555) 742-9912',
        email: 'patient@auracare.com',
        address: '742 Evergreen Terrace, Springfield, IL 62704',
        cnic: '35201-7894561-3',
        emergencyName: 'Martha Pendleton',
        emergencyPhone: '+1 (555) 742-9913',
        emergencyRelation: 'Spouse',
        allergies: 'Penicillin, Cephalosporins (Moderate rash and bronchospasm)',
        medicalHistory: 'Hypertension (diagnosed 2019), Mild Osteoarthritis in left knee, Family history of CAD.',
        regDate: '2026-01-10',
        status: 'active',
        profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
        maritalStatus: 'married',
        occupation: 'Senior Systems Architect',
        insuranceProvider: 'BlueCross BlueShield Premier',
        insurancePolicy: 'BCBS-8839210-A'
      },
      {
        userId: null,
        patientCode: 'PAT-2026-0002',
        firstName: 'Eleanor',
        lastName: 'Vance',
        gender: 'female',
        dateOfBirth: '1992-11-23',
        bloodGroup: 'A+',
        phone: '+1 (555) 321-8844',
        email: 'eleanor.vance@healthmail.com',
        address: '1204 Pinecrest Blvd, Suite 8, Oakridge, IL 60010',
        cnic: '42101-1234567-1',
        emergencyName: 'David Vance',
        emergencyPhone: '+1 (555) 321-8845',
        emergencyRelation: 'Brother',
        allergies: 'Sulfa drugs, Latex (Skin contact dermatitis)',
        medicalHistory: 'Chronic Migraine with aura, Iron Deficiency Anemia, Appendectomy (2018).',
        regDate: '2026-02-04',
        status: 'active',
        profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
        maritalStatus: 'single',
        occupation: 'Biomedical Researcher',
        insuranceProvider: 'Aetna Health Gold',
        insurancePolicy: 'AET-4910284-B'
      },
      {
        userId: null,
        patientCode: 'PAT-2026-0003',
        firstName: 'Julian',
        lastName: 'Mercer',
        gender: 'male',
        dateOfBirth: '1976-03-30',
        bloodGroup: 'B+',
        phone: '+1 (555) 674-1109',
        email: 'j.mercer@innovatetech.io',
        address: '550 W Washington Blvd, Penthouse 4, Chicago, IL 60661',
        cnic: '37405-9876543-5',
        emergencyName: 'Clara Mercer',
        emergencyPhone: '+1 (555) 674-1110',
        emergencyRelation: 'Spouse',
        allergies: 'No known drug allergies (NKDA)',
        medicalHistory: 'Type 2 Diabetes Mellitus (HbA1c 7.2%), Dyslipidemia, Non-smoker.',
        regDate: '2026-03-15',
        status: 'active',
        profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
        maritalStatus: 'married',
        occupation: 'Managing Director',
        insuranceProvider: 'UnitedHealthcare Choice Plus',
        insurancePolicy: 'UHC-9920194-X'
      },
      {
        userId: null,
        patientCode: 'PAT-2026-0004',
        firstName: 'Sophia',
        lastName: 'Rodriguez',
        gender: 'female',
        dateOfBirth: '2001-08-19',
        bloodGroup: 'AB-',
        phone: '+1 (555) 890-4421',
        email: 'sophia.rodriguez@university.edu',
        address: '88 College Avenue, Apt 2B, Evanston, IL 60201',
        cnic: '61101-5678901-2',
        emergencyName: 'Maria Rodriguez',
        emergencyPhone: '+1 (555) 890-4422',
        emergencyRelation: 'Mother',
        allergies: 'Peanuts, Shellfish (Severe anaphylaxis, carries EpiPen)',
        medicalHistory: 'Mild Bronchial Asthma (exercise-induced), Seasonal Allergic Rhinitis.',
        regDate: '2026-04-02',
        status: 'active',
        profileImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
        maritalStatus: 'single',
        occupation: 'Graduate Student',
        insuranceProvider: 'Cigna Global Health',
        insurancePolicy: 'CGH-1029384-S'
      },
      {
        userId: null,
        patientCode: 'PAT-2026-0005',
        firstName: 'Harrison',
        lastName: 'Fordham',
        gender: 'male',
        dateOfBirth: '1962-12-05',
        bloodGroup: 'O-',
        phone: '+1 (555) 433-2198',
        email: 'harrison.fordham@legacyconsulting.com',
        address: '410 North Michigan Ave, Chicago, IL 60611',
        cnic: '35202-3456789-9',
        emergencyName: 'Patricia Fordham',
        emergencyPhone: '+1 (555) 433-2199',
        emergencyRelation: 'Spouse',
        allergies: 'Aspirin, NSAIDs (Gastric bleeding history)',
        medicalHistory: 'Coronary Artery Stent placement (LAD, 2022), GERD, Hypercholesterolemia.',
        regDate: '2026-05-18',
        status: 'active',
        profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
        maritalStatus: 'married',
        occupation: 'Retired Executive',
        insuranceProvider: 'Medicare Advantage Plan',
        insurancePolicy: 'MED-7744110-Z'
      },
      {
        userId: null,
        patientCode: 'PAT-2026-0006',
        firstName: 'Amina',
        lastName: 'Al-Mansoor',
        gender: 'female',
        dateOfBirth: '1995-04-12',
        bloodGroup: 'A-',
        phone: '+1 (555) 912-3344',
        email: 'amina.mansoor@globalhealth.org',
        address: '303 E Wacker Dr, Unit 14A, Chicago, IL 60601',
        cnic: '42201-8765432-6',
        emergencyName: 'Tariq Al-Mansoor',
        emergencyPhone: '+1 (555) 912-3345',
        emergencyRelation: 'Father',
        allergies: 'Codeine, Morphine (Severe nausea and hallucinations)',
        medicalHistory: 'Hypothyroidism (Hashimoto disease, on Levothyroxine), Vitamin D deficiency.',
        regDate: '2026-06-11',
        status: 'active',
        profileImage: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
        maritalStatus: 'single',
        occupation: 'Policy Analyst',
        insuranceProvider: 'Humana Platinum Choice',
        insurancePolicy: 'HUM-3301928-M'
      },
      {
        userId: null,
        patientCode: 'PAT-2026-0007',
        firstName: 'Marcus',
        lastName: 'Sterling',
        gender: 'male',
        dateOfBirth: '1970-09-28',
        bloodGroup: 'B-',
        phone: '+1 (555) 555-7812',
        email: 'm.sterling@sterlinglegal.com',
        address: '900 N Lake Shore Dr, Chicago, IL 60611',
        cnic: '37201-6543210-4',
        emergencyName: 'Brenda Sterling',
        emergencyPhone: '+1 (555) 555-7813',
        emergencyRelation: 'Sister',
        allergies: 'Ciprofloxacin (Tendonitis risk)',
        medicalHistory: 'Gout, Chronic lower back pain, Lumbar L4-L5 disc herniation.',
        regDate: '2026-07-01',
        status: 'inactive',
        profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80',
        maritalStatus: 'divorced',
        occupation: 'Attorney at Law',
        insuranceProvider: 'Kaiser Permanente Senior',
        insurancePolicy: 'KP-9911223-L'
      },
      {
        userId: null,
        patientCode: 'PAT-2026-0008',
        firstName: 'Chloe',
        lastName: 'Dubois',
        gender: 'female',
        dateOfBirth: '1998-02-14',
        bloodGroup: 'AB+',
        phone: '+1 (555) 234-9988',
        email: 'chloe.dubois@auradesign.fr',
        address: '150 N Riverside Plaza, Chicago, IL 60606',
        cnic: '35201-1122334-8',
        emergencyName: 'Luc Dubois',
        emergencyPhone: '+1 (555) 234-9989',
        emergencyRelation: 'Spouse',
        allergies: 'No known allergies',
        medicalHistory: 'Routine prenatal evaluations (G1P0, 24 weeks gestation).',
        regDate: '2026-07-22',
        status: 'active',
        profileImage: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80',
        maritalStatus: 'married',
        occupation: 'UX Design Lead',
        insuranceProvider: 'BlueCross BlueShield Premier',
        insurancePolicy: 'BCBS-4422001-D'
      }
    ];

    for (const p of patientsData) {
      await db.query(`
        INSERT INTO patients (
          user_id, patient_code, first_name, last_name, gender, date_of_birth, blood_group,
          phone, email, address, identification_number, emergency_contact_name, emergency_contact_phone,
          emergency_contact_relation, allergies, medical_history, registration_date, status, profile_image,
          marital_status, occupation, insurance_provider, insurance_policy_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          first_name = VALUES(first_name),
          last_name = VALUES(last_name),
          phone = VALUES(phone),
          email = VALUES(email),
          address = VALUES(address),
          identification_number = VALUES(identification_number),
          emergency_contact_name = VALUES(emergency_contact_name),
          emergency_contact_phone = VALUES(emergency_contact_phone),
          emergency_contact_relation = VALUES(emergency_contact_relation),
          allergies = VALUES(allergies),
          medical_history = VALUES(medical_history),
          registration_date = VALUES(registration_date),
          status = VALUES(status),
          profile_image = VALUES(profile_image),
          marital_status = VALUES(marital_status),
          occupation = VALUES(occupation),
          insurance_provider = VALUES(insurance_provider),
          insurance_policy_number = VALUES(insurance_policy_number)
      `, [
        p.userId, p.patientCode, p.firstName, p.lastName, p.gender, p.dateOfBirth, p.bloodGroup,
        p.phone, p.email, p.address, p.cnic, p.emergencyName, p.emergencyPhone,
        p.emergencyRelation, p.allergies, p.medicalHistory, p.regDate, p.status, p.profileImage,
        p.maritalStatus, p.occupation, p.insuranceProvider, p.insurancePolicy
      ]);
    }
  }

  // 8. Seed Appointments
  const [apptCount] = await db.query('SELECT COUNT(*) as count FROM appointments');
  if (apptCount[0].count === 0) {
    console.log('Seeding clinical appointments...');
    await db.query(`
      INSERT INTO appointments (id, appointment_number, patient_id, doctor_id, department_id, appointment_date, appointment_time, type, status, reason, notes) VALUES
      (1, 'APT-2026-1001', 1, 1, 1, '2026-08-10', '09:30:00', 'consultation', 'completed', 'Routine cardiovascular checkup and ECG analysis', 'Patient reported occasional exertional palpitation. Resting ECG normal sinus rhythm.'),
      (2, 'APT-2026-1002', 1, 2, 2, '2026-08-22', '14:00:00', 'follow_up', 'confirmed', 'Follow-up for tension headache evaluation', 'Review MRI results and prescribe prophylactic regimen.'),
      (3, 'APT-2026-1003', 2, 2, 2, '2026-08-12', '10:15:00', 'consultation', 'completed', 'Refractory migraine with visual scotoma', 'Initiated trial of CGRP antagonist and lifestyle modification plan.'),
      (4, 'APT-2026-1004', 3, 1, 1, '2026-08-16', '11:00:00', 'consultation', 'confirmed', 'Diabetes annual cardiac risk stratification', 'Pre-consultation lipid profile ordered.'),
      (5, 'APT-2026-1005', 4, 1, 1, '2026-08-18', '15:30:00', 'general', 'pending', 'Allergy desensitization review and pulmonary check', 'Seasonal asthma symptom review.'),
      (6, 'APT-2026-1006', 5, 1, 1, '2026-08-08', '08:45:00', 'follow_up', 'completed', 'Post-stent coronary evaluation (annual)', 'Dual antiplatelet therapy adherence reviewed. Echo EF 58%.')
      ON DUPLICATE KEY UPDATE appointment_number = VALUES(appointment_number);
    `);
  }

  // 9. Seed Medical Records (EMR)
  const [mrCount] = await db.query('SELECT COUNT(*) as count FROM medical_records');
  if (mrCount[0].count === 0) {
    console.log('Seeding electronic medical records...');
    await db.query(`
      INSERT INTO medical_records (id, patient_id, doctor_id, appointment_id, record_date, chief_complaint, diagnosis, vitals_json, clinical_notes, follow_up_date) VALUES
      (1, 1, 1, 1, '2026-08-10', 'Intermittent chest flutter during stair climbing, no radiating pain or syncope.', 'Essential Hypertension (controlled), Benign Sinus Tachycardia', '{"bp": "128/82", "pulse": 78, "temp": 98.4, "spo2": 99, "weight": 82.5, "bmi": 26.2}', 'Resting 12-lead ECG confirms normal sinus rhythm, QTc interval 410ms. Advised low sodium diet and 30 min daily brisk walking.', '2026-11-10'),
      (2, 2, 2, 3, '2026-08-12', 'Throbbing unilateral frontotemporal headache with photophobia lasting 18 hours.', 'Chronic Episodic Migraine with Visual Aura (ICD-10 G43.1)', '{"bp": "118/74", "pulse": 72, "temp": 98.6, "spo2": 98, "weight": 58.0, "bmi": 21.4}', 'Neurological cranial nerve examination intact. Fundoscopic exam unremarkable with sharp disc margins. Initiated preventative therapy.', '2026-09-12'),
      (3, 5, 1, 6, '2026-08-08', 'Annual surveillance post-LAD coronary stent placement.', 'Atherosclerotic Coronary Artery Disease with patent LAD stent', '{"bp": "122/78", "pulse": 64, "temp": 98.2, "spo2": 99, "weight": 86.0, "bmi": 27.5}', 'Transthoracic echocardiogram demonstrates normal LV systolic function, ejection fraction 58%. No regional wall motion abnormalities.', '2027-08-08')
      ON DUPLICATE KEY UPDATE chief_complaint = VALUES(chief_complaint);
    `);
  }

  // 10. Seed Prescriptions
  const [rxCount] = await db.query('SELECT COUNT(*) as count FROM prescriptions');
  if (rxCount[0].count === 0) {
    console.log('Seeding patient prescriptions...');
    await db.query(`
      INSERT INTO prescriptions (record_id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, instructions) VALUES
      (1, 1, 1, 'Lipitor (Atorvastatin)', '20mg', 'Once daily at bedtime', '90 Days', 'Take with or without food. Avoid excessive grapefruit consumption.'),
      (1, 1, 1, 'Cozaar (Losartan Potassium)', '50mg', 'Once daily in morning', '90 Days', 'Monitor blood pressure weekly. Stay adequately hydrated.'),
      (2, 2, 2, 'Nurtec ODT (Rimegepant)', '75mg', 'As needed at migraine onset', '30 Days', 'Dissolve on or under tongue at earliest onset of aura or migraine pain.'),
      (2, 2, 2, 'Topamax (Topiramate)', '25mg', 'Once daily at night', '60 Days', 'Titrate to 50mg after 2 weeks if tolerated. Drink plenty of water.'),
      (3, 5, 1, 'Plavix (Clopidogrel)', '75mg', 'Once daily with meal', '180 Days', 'Do not discontinue without cardiologist consultation.'),
      (3, 5, 1, 'Crestor (Rosuvastatin)', '40mg', 'Once daily at bedtime', '180 Days', 'Maintain intensive lipid-lowering target (LDL < 55 mg/dL).')
      ON DUPLICATE KEY UPDATE medicine_name = VALUES(medicine_name);
    `);
  }

  // 11. Seed Lab Orders & Reports
  const [labOrdCount] = await db.query('SELECT COUNT(*) as count FROM lab_orders');
  if (labOrdCount[0].count === 0) {
    console.log('Seeding diagnostic laboratory reports...');
    await db.query(`
      INSERT INTO lab_orders (order_number, patient_id, doctor_id, test_id, order_date, sample_type, sample_collected_at, result_value, result_notes, status, completed_at) VALUES
      ('LAB-2026-8001', 1, 1, 1, '2026-08-10', 'Whole Blood (EDTA)', '2026-08-10 10:00:00', 'WBC: 6.8, RBC: 4.9, Hb: 15.2 g/dL, Plt: 245', 'All hematology indices within normal physiological limits.', 'completed', '2026-08-10 14:30:00'),
      ('LAB-2026-8002', 1, 1, 3, '2026-08-10', 'Serum (SST)', '2026-08-10 10:00:00', 'Total Chol: 168 mg/dL, HDL: 52 mg/dL, LDL: 88 mg/dL, Trig: 140 mg/dL', 'Target LDL goal achieved on current Atorvastatin 20mg regimen.', 'completed', '2026-08-10 16:00:00'),
      ('LAB-2026-8003', 2, 2, 7, '2026-08-12', 'Neuroimaging (MRI)', '2026-08-12 11:30:00', 'Brain MRI 3.0T: Normal parenchymal signal intensity, no intracranial lesion', 'Radiologist Dr. S. Jenkins confirms clear brain scan with no demyelination.', 'completed', '2026-08-13 09:15:00'),
      ('LAB-2026-8004', 3, 1, 4, '2026-08-15', 'Whole Blood (EDTA)', '2026-08-15 08:30:00', 'HbA1c: 7.1%', 'Moderate glycemic control. Discuss Metformin adjustment with endocrinologist.', 'completed', '2026-08-15 12:00:00'),
      ('LAB-2026-8005', 1, 1, 8, '2026-08-20', 'Electrocardiogram', NULL, NULL, 'Scheduled for resting 12-lead baseline test.', 'ordered', NULL)
      ON DUPLICATE KEY UPDATE order_number = VALUES(order_number);
    `);
  }

  // 12. Seed Invoices & Payments
  const [invCount] = await db.query('SELECT COUNT(*) as count FROM invoices');
  if (invCount[0].count === 0) {
    console.log('Seeding patient invoices and receipts...');
    await db.query(`
      INSERT INTO invoices (id, invoice_number, patient_id, appointment_id, total_amount, discount_amount, tax_amount, net_amount, status, due_date) VALUES
      (1, 'INV-2026-5001', 1, 1, 200.00, 20.00, 10.00, 190.00, 'paid', '2026-08-25'),
      (2, 'INV-2026-5002', 1, NULL, 80.00, 0.00, 4.00, 84.00, 'unpaid', '2026-09-10'),
      (3, 'INV-2026-5003', 2, 3, 195.00, 0.00, 10.00, 205.00, 'paid', '2026-08-26'),
      (4, 'INV-2026-5004', 3, 4, 160.00, 10.00, 8.00, 158.00, 'partially_paid', '2026-08-30'),
      (5, 'INV-2026-5005', 5, 6, 210.00, 30.00, 9.00, 189.00, 'paid', '2026-08-22')
      ON DUPLICATE KEY UPDATE invoice_number = VALUES(invoice_number);
    `);

    await db.query(`
      INSERT INTO payments (id, invoice_id, amount_paid, payment_method, transaction_ref, notes) VALUES
      (1, 1, 190.00, 'card', 'TXN-VISA-99201844', 'Settled in full via contactless Visa ending in 4921.'),
      (2, 3, 205.00, 'insurance', 'TXN-AET-CLAIM-448102', 'Direct insurance copay claim reimbursement.'),
      (3, 4, 80.00, 'online', 'TXN-STRIPE-882190', 'Partial downpayment paid via patient web portal.'),
      (4, 5, 189.00, 'card', 'TXN-MC-33992100', 'Paid at front desk reception terminal.')
      ON DUPLICATE KEY UPDATE transaction_ref = VALUES(transaction_ref);
    `);
  }

  // 13. Seed Patient Documents
  const [docFileCount] = await db.query('SELECT COUNT(*) as count FROM patient_documents');
  if (docFileCount[0].count === 0) {
    console.log('Seeding clinical documents and records...');
    await db.query(`
      INSERT INTO patient_documents (patient_id, document_name, document_type, file_path, file_size_kb, uploaded_by, notes) VALUES
      (1, 'Cardiology ECG Tracing (Resting 12-Lead)', 'Diagnostic Report', '/uploads/documents/pat1_ecg_tracing_2026.pdf', 340, 3, 'Baseline resting ECG report verified by Dr. Marcus Vance.'),
      (1, 'Coronary Calcium Score CT Scan Summary', 'Radiology Scan', '/uploads/documents/pat1_ct_calcium_score.pdf', 1250, 3, 'Agatston calcium score evaluation.'),
      (1, 'State ID / Identification Document Scan', 'Identity Document', '/uploads/documents/pat1_national_id_verified.pdf', 510, 5, 'Verified identity document at reception check-in.'),
      (2, 'Brain MRI 3.0T High Resolution Neuro-Scans', 'Radiology Scan', '/uploads/documents/pat2_brain_mri_3t.pdf', 4200, 4, 'Full diagnostic coronal and axial T1/T2 weighted sequences.'),
      (2, 'Discharge Summary & Treatment Plan 2026', 'Discharge Summary', '/uploads/documents/pat2_discharge_summary.pdf', 280, 4, 'Neurology outpatient clinical plan and acute migraine protocol.'),
      (5, 'Cardiac Cath Lab Operative Note (LAD Stent)', 'Surgical Report', '/uploads/documents/pat5_cardiac_cath_op_note.pdf', 890, 3, 'Stent deployment procedural documentation and angiograms.')
      ON DUPLICATE KEY UPDATE document_name = VALUES(document_name);
    `);
  }

  // 14. Seed Vitals History
  const [vitalsCount] = await db.query('SELECT COUNT(*) as count FROM vitals');
  if (vitalsCount[0].count === 0) {
    console.log('Seeding patient vital signs timeline...');
    await db.query(`
      INSERT INTO vitals (patient_id, recorded_by, systolic, diastolic, heart_rate, temperature, respiratory_rate, oxygen_saturation, blood_sugar, weight_kg, height_cm, bmi, notes) VALUES
      (1, 6, 128, 82, 78, 98.4, 16, 99, 105, 82.5, 178.0, 26.0, 'Triage assessment before cardiology consult. Patient feeling well.'),
      (1, 6, 132, 84, 80, 98.6, 15, 99, 110, 83.0, 178.0, 26.2, 'Routine follow-up vitals recording.'),
      (2, 6, 118, 74, 72, 98.6, 14, 98, 92, 58.0, 165.0, 21.3, 'Afebrile, stable hemodynamics at neurology intake.'),
      (3, 6, 136, 88, 82, 98.5, 16, 98, 142, 89.0, 180.0, 27.5, 'Pre-prandial blood sugar recorded in morning clinic.'),
      (5, 6, 122, 78, 64, 98.2, 14, 99, 98, 86.0, 176.0, 27.8, 'Post-exercise recovery vitals within normal parameters.')
      ON DUPLICATE KEY UPDATE notes = VALUES(notes);
    `);
  }

  console.log('🎉 [PATIENT MODULE MIGRATION] All tables upgraded, relations established, and rich datasets seeded successfully!');
}

if (require.main === module) {
  migrateAndSeedPatientModule()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ [MIGRATION ERROR]', err);
      process.exit(1);
    });
}

module.exports = migrateAndSeedPatientModule;
