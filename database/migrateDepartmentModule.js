const db = require('../server/config/db');

async function migrateDepartmentModule() {
  console.log('🚀 Starting Hospital Department Module Database Migration...');

  // 1. Check and add columns to departments table
  const [columns] = await db.query('DESCRIBE departments');
  const colNames = columns.map(c => c.Field);

  if (!colNames.includes('floor_location')) {
    console.log('Adding floor_location column to departments table...');
    await db.query('ALTER TABLE departments ADD COLUMN floor_location VARCHAR(100) NULL AFTER icon');
  }

  if (!colNames.includes('phone')) {
    console.log('Adding phone column to departments table...');
    await db.query('ALTER TABLE departments ADD COLUMN phone VARCHAR(30) NULL AFTER floor_location');
  }

  if (!colNames.includes('email')) {
    console.log('Adding email column to departments table...');
    await db.query('ALTER TABLE departments ADD COLUMN email VARCHAR(120) NULL AFTER phone');
  }

  if (!colNames.includes('emergency_available')) {
    console.log('Adding emergency_available column to departments table...');
    await db.query('ALTER TABLE departments ADD COLUMN emergency_available TINYINT(1) DEFAULT 0 AFTER email');
  }

  if (!colNames.includes('consultation_base_fee')) {
    console.log('Adding consultation_base_fee column to departments table...');
    await db.query('ALTER TABLE departments ADD COLUMN consultation_base_fee DECIMAL(10,2) DEFAULT 50.00 AFTER emergency_available');
  }

  // 2. Comprehensive Seed Departments
  const seedDepartments = [
    {
      code: 'CARD',
      name: 'Cardiology',
      description: 'Advanced cardiovascular care, ECG diagnostics, heart failure management, and interventional catheterization.',
      icon: 'fa-heart-pulse',
      floor_location: 'Floor 3, Heart & Vascular Pavilion',
      phone: '+1 (555) 234-5101',
      email: 'cardiology@auracare.com',
      emergency_available: 1,
      consultation_base_fee: 150.00
    },
    {
      code: 'NEUR',
      name: 'Neurology',
      description: 'Comprehensive neurological disorders, EEG analysis, stroke therapeutics, and neuro-rehabilitation.',
      icon: 'fa-brain',
      floor_location: 'Floor 4, Neuroscience Center',
      phone: '+1 (555) 234-5102',
      email: 'neurology@auracare.com',
      emergency_available: 1,
      consultation_base_fee: 160.00
    },
    {
      code: 'PED',
      name: 'Pediatrics',
      description: 'Complete infant, child, and adolescent healthcare, neonatology, immunization, and developmental monitoring.',
      icon: 'fa-baby',
      floor_location: 'Floor 1, Childrens Health Wing',
      phone: '+1 (555) 234-5103',
      email: 'pediatrics@auracare.com',
      emergency_available: 1,
      consultation_base_fee: 110.00
    },
    {
      code: 'ORTH',
      name: 'Orthopedics',
      description: 'Musculoskeletal surgery, joint arthroplasty, spine surgery, and sports medicine trauma care.',
      icon: 'fa-bone',
      floor_location: 'Floor 2, Orthopedic & Joint Institute',
      phone: '+1 (555) 234-5104',
      email: 'orthopedics@auracare.com',
      emergency_available: 0,
      consultation_base_fee: 175.00
    },
    {
      code: 'DERM',
      name: 'Dermatology',
      description: 'Skin diagnostics, cutaneous oncology, psoriasis biologics, laser therapeutics, and aesthetic clinical dermatology.',
      icon: 'fa-hand-dots',
      floor_location: 'Floor 1, Suite 115 (Skin & Laser Dept)',
      phone: '+1 (555) 234-5105',
      email: 'dermatology@auracare.com',
      emergency_available: 0,
      consultation_base_fee: 120.00
    },
    {
      code: 'GEN',
      name: 'General Internal Medicine',
      description: 'Primary adult care, chronic multi-system disease management, and preventative health screenings.',
      icon: 'fa-stethoscope',
      floor_location: 'Ground Floor, Outpatient Clinic A',
      phone: '+1 (555) 234-5106',
      email: 'internal.med@auracare.com',
      emergency_available: 0,
      consultation_base_fee: 90.00
    },
    {
      code: 'ER',
      name: 'Emergency & Trauma',
      description: '24/7 Level-1 Acute trauma resuscitation, emergent cardiac arrest management, and rapid triage.',
      icon: 'fa-truck-medical',
      floor_location: 'Ground Floor, Dedicated Emergency Bay',
      phone: '+1 (555) 234-9999',
      email: 'emergency@auracare.com',
      emergency_available: 1,
      consultation_base_fee: 200.00
    },
    {
      code: 'GYN',
      name: 'Gynecology & Obstetrics',
      description: 'Maternal-fetal medicine, comprehensive prenatal care, high-risk obstetrics, and gynecological surgery.',
      icon: 'fa-person-pregnant',
      floor_location: 'Floor 5, Women & Newborn Center',
      phone: '+1 (555) 234-5107',
      email: 'obgyn@auracare.com',
      emergency_available: 1,
      consultation_base_fee: 130.00
    },
    {
      code: 'ENT',
      name: 'Otolaryngology (ENT)',
      description: 'Ear, nose, throat diagnostics, audiology testing, endoscopic sinus surgery, and head/neck therapeutics.',
      icon: 'fa-ear-listen',
      floor_location: 'Floor 2, Sensory Clinic Suite 220',
      phone: '+1 (555) 234-5108',
      email: 'ent@auracare.com',
      emergency_available: 0,
      consultation_base_fee: 115.00
    },
    {
      code: 'DENT',
      name: 'Dentistry & Maxillofacial',
      description: 'General dental care, endodontics, orthodontics, oral prosthetics, and maxillofacial reconstruction.',
      icon: 'fa-tooth',
      floor_location: 'Floor 2, Dental Care Suites 240',
      phone: '+1 (555) 234-5109',
      email: 'dentistry@auracare.com',
      emergency_available: 0,
      consultation_base_fee: 95.00
    },
    {
      code: 'RAD',
      name: 'Radiology & Imaging',
      description: 'Diagnostic PACS imaging: Digital X-Ray, 128-Slice CT, 3.0T MRI scans, ultrasound, and mammography.',
      icon: 'fa-radiation',
      floor_location: 'Basement Level 1, Diagnostic Imaging Center',
      phone: '+1 (555) 234-5110',
      email: 'radiology@auracare.com',
      emergency_available: 1,
      consultation_base_fee: 140.00
    },
    {
      code: 'PATH',
      name: 'Pathology & Laboratory Medicine',
      description: 'Automated clinical biochemistry, hematology, molecular microbiology, histology, and blood bank banking.',
      icon: 'fa-microscope',
      floor_location: 'Floor 2, Central Diagnostic Labs',
      phone: '+1 (555) 234-5111',
      email: 'pathology@auracare.com',
      emergency_available: 1,
      consultation_base_fee: 75.00
    },
    {
      code: 'ONCO',
      name: 'Oncology',
      description: 'Medical oncology, targeted immunotherapy, chemotherapy administration, and precision tumor staging consultations.',
      icon: 'fa-dna',
      floor_location: 'Floor 5, Comprehensive Cancer Center',
      phone: '+1 (555) 234-5112',
      email: 'oncology@auracare.com',
      emergency_available: 0,
      consultation_base_fee: 190.00
    },
    {
      code: 'SURG',
      name: 'General Surgery',
      description: 'Minimally invasive laparoscopic, elective gastrointestinal, abdominal wall hernia, and oncologic surgical procedures.',
      icon: 'fa-syringe',
      floor_location: 'Floor 3, Surgical Suites & OR Wing',
      phone: '+1 (555) 234-5113',
      email: 'surgery@auracare.com',
      emergency_available: 1,
      consultation_base_fee: 140.00
    },
    {
      code: 'OPHT',
      name: 'Ophthalmology',
      description: 'Cataract microsurgery, visual acuity diagnostics, retinal care, glaucoma laser therapeutics, and cornea management.',
      icon: 'fa-eye',
      floor_location: 'Floor 1, Eye & Vision Clinic',
      phone: '+1 (555) 234-5114',
      email: 'ophthalmology@auracare.com',
      emergency_available: 0,
      consultation_base_fee: 125.00
    }
  ];

  for (const dept of seedDepartments) {
    const [existing] = await db.query('SELECT id FROM departments WHERE code = ? OR name = ?', [dept.code, dept.name]);
    if (existing.length > 0) {
      await db.query(
        `UPDATE departments 
         SET name = ?, description = ?, icon = ?, floor_location = ?, phone = ?, email = ?, 
             emergency_available = ?, consultation_base_fee = ?, is_active = 1 
         WHERE id = ?`,
        [dept.name, dept.description, dept.icon, dept.floor_location, dept.phone, dept.email, dept.emergency_available, dept.consultation_base_fee, existing[0].id]
      );
      console.log(`~ Department updated: ${dept.name} (${dept.code})`);
    } else {
      await db.query(
        `INSERT INTO departments 
         (code, name, description, icon, floor_location, phone, email, emergency_available, consultation_base_fee, is_active) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [dept.code, dept.name, dept.description, dept.icon, dept.floor_location, dept.phone, dept.email, dept.emergency_available, dept.consultation_base_fee]
      );
      console.log(`+ Department created: ${dept.name} (${dept.code})`);
    }
  }

  // 3. Assign Head of Department for key doctors
  // E.g., Dr. Marcus Vance (Cardiology), Dr. Elena Rostova (Neurology), Dr. Sarah Jenkins (Pediatrics), Dr. Tariq Mahmood (Orthopedics)
  const [docRows] = await db.query('SELECT id, doctor_code, department_id FROM doctors');
  for (const doc of docRows) {
    if (doc.doctor_code === 'DOC-2026-0001') {
      await db.query('UPDATE departments SET head_doctor_id = ? WHERE code = "CARD"', [doc.id]);
    } else if (doc.doctor_code === 'DOC-2026-0002') {
      await db.query('UPDATE departments SET head_doctor_id = ? WHERE code = "NEUR"', [doc.id]);
    } else if (doc.doctor_code === 'DOC-2026-0003') {
      await db.query('UPDATE departments SET head_doctor_id = ? WHERE code = "PED"', [doc.id]);
    } else if (doc.doctor_code === 'DOC-2026-0004') {
      await db.query('UPDATE departments SET head_doctor_id = ? WHERE code = "ORTH"', [doc.id]);
    } else if (doc.doctor_code === 'DOC-2026-0005') {
      await db.query('UPDATE departments SET head_doctor_id = ? WHERE code = "DERM"', [doc.id]);
    } else if (doc.doctor_code === 'DOC-2026-0006') {
      await db.query('UPDATE departments SET head_doctor_id = ? WHERE code = "ONCO"', [doc.id]);
    } else if (doc.doctor_code === 'DOC-2026-0007') {
      await db.query('UPDATE departments SET head_doctor_id = ? WHERE code = "SURG"', [doc.id]);
    } else if (doc.doctor_code === 'DOC-2026-0008') {
      await db.query('UPDATE departments SET head_doctor_id = ? WHERE code = "OPHT"', [doc.id]);
    }
  }

  console.log('🎉 Hospital Department Module Migration Completed Successfully!');
}

if (require.main === module) {
  migrateDepartmentModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateDepartmentModule;
