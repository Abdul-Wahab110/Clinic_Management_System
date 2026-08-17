const db = require('../server/config/db');
const bcrypt = require('bcryptjs');

async function migrateDoctorModule() {
  console.log('🚀 Starting Doctor Management Module Database Migration...');

  // 1. Check and add required columns to doctors table
  const [columns] = await db.query('DESCRIBE doctors');
  const colNames = columns.map(c => c.Field);

  if (!colNames.includes('doctor_code')) {
    console.log('Adding doctor_code column to doctors table...');
    await db.query('ALTER TABLE doctors ADD COLUMN doctor_code VARCHAR(30) UNIQUE AFTER user_id');
  }

  if (!colNames.includes('license_number')) {
    console.log('Adding license_number column to doctors table...');
    await db.query('ALTER TABLE doctors ADD COLUMN license_number VARCHAR(60) AFTER qualification');
  }

  if (!colNames.includes('status')) {
    console.log('Adding status column to doctors table...');
    await db.query("ALTER TABLE doctors ADD COLUMN status ENUM('active', 'inactive', 'on_leave', 'suspended') DEFAULT 'active' AFTER is_available");
  }

  if (!colNames.includes('profile_image')) {
    console.log('Adding profile_image column to doctors table...');
    await db.query('ALTER TABLE doctors ADD COLUMN profile_image VARCHAR(255) NULL AFTER bio');
  }

  // 2. Ensure doctor_schedules table exists and has proper columns
  await db.query(`
    CREATE TABLE IF NOT EXISTS doctor_schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      doctor_id INT NOT NULL,
      day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      slot_duration_minutes INT DEFAULT 20,
      max_patients INT DEFAULT 20,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      UNIQUE KEY uq_doctor_day (doctor_id, day_of_week)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Ensure core departments exist
  const departments = [
    { code: 'CARD', name: 'Cardiology', description: 'Advanced cardiovascular care, ECG diagnostics, and interventional cardiology.' },
    { code: 'NEUR', name: 'Neurology', description: 'Comprehensive neurological disorders, EEG analysis, and neuro-rehabilitation.' },
    { code: 'PED', name: 'Pediatrics', description: 'Complete infant, child, and adolescent healthcare and developmental tracking.' },
    { code: 'ORTH', name: 'Orthopedics', description: 'Musculoskeletal surgery, joint arthroplasty, and trauma care.' },
    { code: 'DERM', name: 'Dermatology', description: 'Skin diagnostics, laser therapeutics, and aesthetic clinical dermatology.' },
    { code: 'ONCO', name: 'Oncology', description: 'Medical oncology, chemotherapy administration, and tumor staging consultations.' },
    { code: 'SURG', name: 'General Surgery', description: 'Minimally invasive laparoscopic and elective surgical interventions.' },
    { code: 'OPHT', name: 'Ophthalmology', description: 'Ocular surgery, visual acuity diagnostics, and retinal care.' }
  ];

  for (const dept of departments) {
    const [existing] = await db.query('SELECT id FROM departments WHERE code = ? OR name = ?', [dept.code, dept.name]);
    if (existing.length === 0) {
      await db.query(
        'INSERT INTO departments (code, name, description, is_active) VALUES (?, ?, ?, 1)',
        [dept.code, dept.name, dept.description]
      );
      console.log(`+ Department created: ${dept.name}`);
    }
  }

  // 4. Seed 8 Specialized Doctors with Users, Profiles & Schedules
  const defaultPasswordHash = await bcrypt.hash('Clinic2026!', 10);
  const DOCTOR_ROLE_ID = 3;

  const doctorSeeds = [
    {
      email: 'marcus.vance@auracare.com',
      fullName: 'Dr. Marcus Vance',
      phone: '+1 (555) 234-5678',
      doctorCode: 'DOC-2026-0001',
      deptCode: 'CARD',
      specialization: 'Senior Interventional Cardiologist',
      qualification: 'MD, FACC, FSCAI (Harvard Medical)',
      licenseNumber: 'MD-CARD-94812',
      experienceYears: 16,
      consultationFee: 150.00,
      roomNumber: 'Suite 301-A (Cardio Wing)',
      bio: 'Dr. Marcus Vance is a board-certified interventional cardiologist specializing in complex coronary interventions, structural heart therapeutics, and preventative cardiac care with over 16 years of academic and clinical practice.',
      status: 'active',
      schedules: [
        { day: 'Monday', start: '09:00:00', end: '14:00:00', slot: 20, max: 15 },
        { day: 'Tuesday', start: '09:00:00', end: '14:00:00', slot: 20, max: 15 },
        { day: 'Wednesday', start: '09:00:00', end: '14:00:00', slot: 20, max: 15 },
        { day: 'Thursday', start: '10:00:00', end: '15:00:00', slot: 20, max: 15 },
        { day: 'Friday', start: '09:00:00', end: '13:00:00', slot: 20, max: 12 }
      ]
    },
    {
      email: 'elena.rostova@auracare.com',
      fullName: 'Dr. Elena Rostova',
      phone: '+1 (555) 345-6789',
      doctorCode: 'DOC-2026-0002',
      deptCode: 'NEUR',
      specialization: 'Consultant Neurologist & Neurophysiologist',
      qualification: 'MD, PhD, FAAN (Johns Hopkins)',
      licenseNumber: 'MD-NEUR-77341',
      experienceYears: 14,
      consultationFee: 160.00,
      roomNumber: 'Suite 405-B (Neuro Center)',
      bio: 'Dr. Elena Rostova is a consultant neurologist specializing in neurodegenerative diseases, epilepsy, and neuromuscular conditions with extensive publications in translational neuroscience.',
      status: 'active',
      schedules: [
        { day: 'Monday', start: '08:30:00', end: '13:30:00', slot: 30, max: 10 },
        { day: 'Wednesday', start: '08:30:00', end: '13:30:00', slot: 30, max: 10 },
        { day: 'Thursday', start: '08:30:00', end: '13:30:00', slot: 30, max: 10 },
        { day: 'Saturday', start: '09:00:00', end: '12:00:00', slot: 30, max: 6 }
      ]
    },
    {
      email: 'sarah.jenkins@auracare.com',
      fullName: 'Dr. Sarah Jenkins',
      phone: '+1 (555) 456-7890',
      doctorCode: 'DOC-2026-0003',
      deptCode: 'PED',
      specialization: 'Chief Pediatrician & Neonatologist',
      qualification: 'MD, FAAP (Stanford Medicine)',
      licenseNumber: 'MD-PEDI-55219',
      experienceYears: 12,
      consultationFee: 110.00,
      roomNumber: 'Room 102 (Children Clinic)',
      bio: 'Dr. Sarah Jenkins is dedicated to providing compassionate, evidence-based pediatric care from newborn well-child evaluations to acute childhood illnesses and developmental monitoring.',
      status: 'active',
      schedules: [
        { day: 'Monday', start: '09:00:00', end: '16:00:00', slot: 20, max: 20 },
        { day: 'Tuesday', start: '09:00:00', end: '16:00:00', slot: 20, max: 20 },
        { day: 'Wednesday', start: '09:00:00', end: '16:00:00', slot: 20, max: 20 },
        { day: 'Thursday', start: '09:00:00', end: '16:00:00', slot: 20, max: 20 },
        { day: 'Friday', start: '09:00:00', end: '14:00:00', slot: 20, max: 15 }
      ]
    },
    {
      email: 'tariq.mahmood@auracare.com',
      fullName: 'Dr. Tariq Mahmood',
      phone: '+1 (555) 567-8901',
      doctorCode: 'DOC-2026-0004',
      deptCode: 'ORTH',
      specialization: 'Orthopedic Spine & Joint Surgeon',
      qualification: 'MBBS, FRCS (Ortho), FAAOS',
      licenseNumber: 'MD-ORTH-88349',
      experienceYears: 18,
      consultationFee: 175.00,
      roomNumber: 'Suite 210 (Orthopedic Pavilion)',
      bio: 'Dr. Tariq Mahmood is an internationally acclaimed orthopedic surgeon with specialized fellowship training in robotic total knee and hip replacements, minimally invasive spinal fusion, and sports trauma.',
      status: 'active',
      schedules: [
        { day: 'Tuesday', start: '08:00:00', end: '13:00:00', slot: 20, max: 15 },
        { day: 'Thursday', start: '08:00:00', end: '13:00:00', slot: 20, max: 15 },
        { day: 'Friday', start: '14:00:00', end: '18:00:00', slot: 20, max: 12 },
        { day: 'Saturday', start: '09:00:00', end: '13:00:00', slot: 20, max: 12 }
      ]
    },
    {
      email: 'aisha.almansoor@auracare.com',
      fullName: 'Dr. Aisha Al-Mansoor',
      phone: '+1 (555) 678-9012',
      doctorCode: 'DOC-2026-0005',
      deptCode: 'DERM',
      specialization: 'Dermatologist & Cutaneous Surgeon',
      qualification: 'MD, FAAD (Oxford University)',
      licenseNumber: 'MD-DERM-44910',
      experienceYears: 10,
      consultationFee: 120.00,
      roomNumber: 'Suite 115 (Skin & Laser Dept)',
      bio: 'Dr. Aisha Al-Mansoor brings expertise in diagnostic dermatology, psoriasis biologics, acne therapeutics, and dermatologic laser surgery with a patient-first holistic approach.',
      status: 'active',
      schedules: [
        { day: 'Monday', start: '10:00:00', end: '16:00:00', slot: 20, max: 18 },
        { day: 'Wednesday', start: '10:00:00', end: '16:00:00', slot: 20, max: 18 },
        { day: 'Friday', start: '10:00:00', end: '15:00:00', slot: 20, max: 15 }
      ]
    },
    {
      email: 'robert.chen@auracare.com',
      fullName: 'Dr. Robert Chen',
      phone: '+1 (555) 789-0123',
      doctorCode: 'DOC-2026-0006',
      deptCode: 'ONCO',
      specialization: 'Medical Oncologist & Hematologist',
      qualification: 'MD, FACP (Memorial Sloan Kettering)',
      licenseNumber: 'MD-ONCO-66192',
      experienceYears: 15,
      consultationFee: 190.00,
      roomNumber: 'Suite 501 (Comprehensive Cancer Center)',
      bio: 'Dr. Robert Chen leads individualized cancer treatment regimens utilizing targeted immunological therapies, molecular tumor genetics, and comprehensive palliative oncology.',
      status: 'active',
      schedules: [
        { day: 'Monday', start: '09:00:00', end: '13:00:00', slot: 30, max: 8 },
        { day: 'Tuesday', start: '09:00:00', end: '13:00:00', slot: 30, max: 8 },
        { day: 'Thursday', start: '09:00:00', end: '13:00:00', slot: 30, max: 8 }
      ]
    },
    {
      email: 'sophia.martinez@auracare.com',
      fullName: 'Dr. Sophia Martinez',
      phone: '+1 (555) 890-1234',
      doctorCode: 'DOC-2026-0007',
      deptCode: 'SURG',
      specialization: 'Consultant Laparoscopic & General Surgeon',
      qualification: 'MD, FACS (UCSF Medical Center)',
      licenseNumber: 'MD-SURG-33821',
      experienceYears: 11,
      consultationFee: 140.00,
      roomNumber: 'Suite 204 (Surgical Clinic)',
      bio: 'Dr. Sophia Martinez specializes in advanced laparoscopic gastrointestinal surgery, abdominal wall hernia repairs, endocrine surgery, and acute surgical oncology.',
      status: 'on_leave',
      schedules: [
        { day: 'Tuesday', start: '10:00:00', end: '15:00:00', slot: 20, max: 15 },
        { day: 'Wednesday', start: '10:00:00', end: '15:00:00', slot: 20, max: 15 },
        { day: 'Friday', start: '09:00:00', end: '13:00:00', slot: 20, max: 12 }
      ]
    },
    {
      email: 'james.wilson@auracare.com',
      fullName: 'Dr. James Wilson',
      phone: '+1 (555) 901-2345',
      doctorCode: 'DOC-2026-0008',
      deptCode: 'OPHT',
      specialization: 'Ophthalmic Surgeon & Retinal Specialist',
      qualification: 'MD, FRCOphth (Moorfields Eye)',
      licenseNumber: 'MD-OPHT-11928',
      experienceYears: 13,
      consultationFee: 125.00,
      roomNumber: 'Suite 108 (Eye Clinic)',
      bio: 'Dr. James Wilson provides comprehensive medical and surgical management for cataracts, diabetic retinopathy, macular degeneration, and refractive disorders.',
      status: 'active',
      schedules: [
        { day: 'Monday', start: '09:00:00', end: '14:00:00', slot: 20, max: 15 },
        { day: 'Wednesday', start: '09:00:00', end: '14:00:00', slot: 20, max: 15 },
        { day: 'Thursday', start: '09:00:00', end: '14:00:00', slot: 20, max: 15 },
        { day: 'Saturday', start: '09:00:00', end: '13:00:00', slot: 20, max: 12 }
      ]
    }
  ];

  for (const docData of doctorSeeds) {
    // Check Department ID
    const [deptRows] = await db.query('SELECT id FROM departments WHERE code = ? OR name LIKE ?', [docData.deptCode, `%${docData.deptCode}%`]);
    if (deptRows.length === 0) continue;
    const departmentId = deptRows[0].id;

    // Check or create User
    let userId;
    const [userRows] = await db.query('SELECT id FROM users WHERE email = ?', [docData.email]);
    if (userRows.length > 0) {
      userId = userRows[0].id;
      await db.query(
        'UPDATE users SET full_name = ?, phone = ?, role_id = ?, status = ? WHERE id = ?',
        [docData.fullName, docData.phone, DOCTOR_ROLE_ID, docData.status === 'inactive' ? 'inactive' : 'active', userId]
      );
    } else {
      const [insertUser] = await db.query(
        'INSERT INTO users (full_name, email, password_hash, role_id, phone, status) VALUES (?, ?, ?, ?, ?, ?)',
        [docData.fullName, docData.email, defaultPasswordHash, DOCTOR_ROLE_ID, docData.phone, docData.status === 'inactive' ? 'inactive' : 'active']
      );
      userId = insertUser.insertId;
      console.log(`+ User created: ${docData.fullName} (${docData.email})`);
    }

    // Check or create Doctor record
    let doctorId;
    const [docRows] = await db.query('SELECT id FROM doctors WHERE user_id = ?', [userId]);
    if (docRows.length > 0) {
      doctorId = docRows[0].id;
      await db.query(
        `UPDATE doctors 
         SET doctor_code = ?, department_id = ?, specialization = ?, qualification = ?, 
             license_number = ?, experience_years = ?, consultation_fee = ?, room_number = ?, 
             bio = ?, status = ?, is_available = ? 
         WHERE id = ?`,
        [
          docData.doctorCode,
          departmentId,
          docData.specialization,
          docData.qualification,
          docData.licenseNumber,
          docData.experienceYears,
          docData.consultationFee,
          docData.roomNumber,
          docData.bio,
          docData.status,
          docData.status === 'active' ? 1 : 0,
          doctorId
        ]
      );
      console.log(`~ Doctor updated: ${docData.fullName} [${docData.doctorCode}]`);
    } else {
      const [insertDoc] = await db.query(
        `INSERT INTO doctors 
         (user_id, doctor_code, department_id, specialization, qualification, license_number, experience_years, consultation_fee, room_number, bio, status, is_available) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          docData.doctorCode,
          departmentId,
          docData.specialization,
          docData.qualification,
          docData.licenseNumber,
          docData.experienceYears,
          docData.consultationFee,
          docData.roomNumber,
          docData.bio,
          docData.status,
          docData.status === 'active' ? 1 : 0
        ]
      );
      doctorId = insertDoc.insertId;
      console.log(`+ Doctor created: ${docData.fullName} [${docData.doctorCode}] (ID: ${doctorId})`);
    }

    // Upsert Schedules
    for (const sched of docData.schedules) {
      await db.query(
        `INSERT INTO doctor_schedules 
         (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, 1) 
         ON DUPLICATE KEY UPDATE 
         start_time = VALUES(start_time), end_time = VALUES(end_time), 
         slot_duration_minutes = VALUES(slot_duration_minutes), max_patients = VALUES(max_patients), is_active = 1`,
        [doctorId, sched.day, sched.start, sched.end, sched.slot, sched.max]
      );
    }
  }

  console.log('🎉 Doctor Management Module Migration Completed Successfully!');
}

if (require.main === module) {
  migrateDoctorModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateDoctorModule;
