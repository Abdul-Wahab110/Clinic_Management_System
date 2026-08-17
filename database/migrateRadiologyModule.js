const db = require('../server/config/db');

async function migrateRadiologyModule() {
  console.log('🩻 Starting Radiology & Imaging Module Database Migration...');

  // 1. Create radiology_modalities table
  await db.query(`
    CREATE TABLE IF NOT EXISTS radiology_modalities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(80) NOT NULL UNIQUE,
      code VARCHAR(30) NOT NULL UNIQUE,
      description TEXT NULL,
      equipment_room VARCHAR(80) NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified radiology_modalities table in MySQL.');

  // Seed default modalities
  const [existingMods] = await db.query('SELECT COUNT(*) as count FROM radiology_modalities');
  if (existingMods[0].count === 0) {
    await db.query(`
      INSERT INTO radiology_modalities (name, code, description, equipment_room) VALUES
      ('Digital X-Ray (Radiography)', 'XR', 'High-definition digital planar bone and soft-tissue projectional radiography', 'Radiology Suite 101'),
      ('Ultrasound (Sonography)', 'USG', 'Multi-frequency real-time Doppler sonography for visceral and vascular imaging', 'Ultrasound Bay 2'),
      ('CT Scan (Computed Tomography)', 'CT', '128-Slice helical multidetector CT for high-resolution volumetric cross-sectional imaging', 'CT Scanner Unit A'),
      ('MRI (Magnetic Resonance Imaging)', 'MRI', '3.0 Tesla wide-bore diagnostic MRI for neural, musculoskeletal, and soft-tissue imaging', 'MRI Unit East Wing'),
      ('Electrocardiogram (ECG)', 'ECG', '12-Lead resting and ambulatory cardiovascular electrical telemetry', 'Cardiology Diagnostics 204'),
      ('Mammography', 'MAMMO', 'Digital 3D tomosynthesis breast imaging and screening', 'Women Diagnostic Suite 105'),
      ('DEXA Bone Densitometry', 'DEXA', 'Dual-energy X-ray absorptiometry for osteopenia and osteoporosis assessment', 'Bone Health Suite 108')
    `);
    console.log('✅ Seeded 7 standard hospital radiology modalities.');
  }

  // 2. Create radiology_services catalog table
  await db.query(`
    CREATE TABLE IF NOT EXISTS radiology_services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      modality_id INT NOT NULL,
      name VARCHAR(150) NOT NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      modality_name VARCHAR(50) NOT NULL,
      body_part VARCHAR(80) NOT NULL,
      contrast_required TINYINT(1) DEFAULT 0,
      fasting_required TINYINT(1) DEFAULT 0,
      duration_minutes INT DEFAULT 30,
      preparation_instructions TEXT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (modality_id) REFERENCES radiology_modalities(id) ON DELETE CASCADE,
      INDEX idx_rad_mod (modality_id),
      INDEX idx_rad_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified radiology_services table in MySQL.');

  // Seed default radiology services
  const [existingSvcs] = await db.query('SELECT COUNT(*) as count FROM radiology_services');
  if (existingSvcs[0].count === 0) {
    const [xr] = await db.query("SELECT id FROM radiology_modalities WHERE code = 'XR' LIMIT 1");
    const [usg] = await db.query("SELECT id FROM radiology_modalities WHERE code = 'USG' LIMIT 1");
    const [ct] = await db.query("SELECT id FROM radiology_modalities WHERE code = 'CT' LIMIT 1");
    const [mri] = await db.query("SELECT id FROM radiology_modalities WHERE code = 'MRI' LIMIT 1");
    const [ecg] = await db.query("SELECT id FROM radiology_modalities WHERE code = 'ECG' LIMIT 1");
    const [mammo] = await db.query("SELECT id FROM radiology_modalities WHERE code = 'MAMMO' LIMIT 1");

    await db.query(`
      INSERT INTO radiology_services 
      (modality_id, name, code, modality_name, body_part, contrast_required, fasting_required, duration_minutes, preparation_instructions, price)
      VALUES
      (${xr[0]?.id || 1}, 'Chest X-Ray (PA & Lateral Views)', 'XR-CHEST-01', 'Digital X-Ray', 'Chest / Thorax', 0, 0, 15, 'Remove metal objects, necklaces, and bra with underwire.', 65.00),
      (${xr[0]?.id || 1}, 'Lumbar Spine X-Ray (AP & Lateral)', 'XR-LUMB-02', 'Digital X-Ray', 'Lumbar Spine', 0, 0, 20, 'Remove belts and metallic fasteners.', 75.00),
      (${xr[0]?.id || 1}, 'Knee Joint X-Ray (AP, Lateral, Skyline)', 'XR-KNEE-03', 'Digital X-Ray', 'Lower Extremity', 0, 0, 15, 'Wear loose clothing or hospital gown.', 60.00),
      (${usg[0]?.id || 2}, 'Whole Abdomen & Pelvic Ultrasound', 'USG-ABD-01', 'Ultrasound', 'Abdomen & Pelvis', 0, 1, 30, 'Fasting for 6 hours prior. Drink 4 glasses of water 1 hour before for full bladder.', 110.00),
      (${usg[0]?.id || 2}, 'Thyroid Ultrasound with Doppler', 'USG-THYR-02', 'Ultrasound', 'Neck & Thyroid', 0, 0, 20, 'No special preparation needed. Avoid high-collar shirts.', 95.00),
      (${usg[0]?.id || 2}, 'Transthoracic Echocardiogram (2D Echo)', 'USG-ECHO-03', 'Ultrasound', 'Heart / Cardiac', 0, 0, 45, 'Rest for 10 minutes before procedure.', 180.00),
      (${ct[0]?.id || 3}, 'Brain CT Scan without Contrast', 'CT-BRAIN-01', 'CT Scan', 'Head & Brain', 0, 0, 20, 'Remove glasses, hearing aids, and dental prostheses.', 220.00),
      (${ct[0]?.id || 3}, 'High-Resolution Chest CT (HRCT)', 'CT-CHEST-02', 'CT Scan', 'Chest / Lungs', 0, 0, 25, 'Hold breath for 10 seconds during scan acquisition.', 280.00),
      (${ct[0]?.id || 3}, 'Abdomen & Pelvis CT with IV Contrast', 'CT-ABDPEL-03', 'CT Scan', 'Abdomen & Pelvis', 1, 1, 40, 'NPO 4 hours prior. Baseline serum creatinine check required.', 350.00),
      (${mri[0]?.id || 4}, 'Brain MRI 3.0T with Diffusion & FLAIR', 'MRI-BRAIN-01', 'MRI', 'Head & Brain', 0, 0, 45, 'Strictly MRI safety screened. No pacemakers, cochlear implants, or metallic foreign bodies.', 450.00),
      (${mri[0]?.id || 4}, 'Lumbar Spine MRI (L1-S1)', 'MRI-LUMB-02', 'MRI', 'Spine & Musculoskeletal', 0, 0, 40, 'Lie still on spine coil during scanning.', 420.00),
      (${mri[0]?.id || 4}, 'Knee Joint MRI with Cartilage Mapping', 'MRI-KNEE-03', 'MRI', 'Joints & Extremity', 0, 0, 40, 'Patient positioned comfortably with dedicated knee coil.', 390.00),
      (${ecg[0]?.id || 5}, '12-Lead Resting Electrocardiogram (ECG)', 'ECG-REST-01', 'ECG', 'Cardiovascular', 0, 0, 15, 'Rest quietly during 10-second signal trace recording.', 50.00),
      (${mammo[0]?.id || 6}, 'Digital Screening Mammography (Bilateral)', 'MAMMO-BIL-01', 'Mammography', 'Breast', 0, 0, 30, 'Do not apply deodorant, powder, or lotions under arms on exam day.', 150.00)
    `);
    console.log('✅ Seeded 14 dynamic hospital radiology and imaging services.');
  }

  // 3. Create radiology_orders table
  await db.query(`
    CREATE TABLE IF NOT EXISTS radiology_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_number VARCHAR(40) NOT NULL UNIQUE,
      patient_id INT NOT NULL,
      doctor_id INT NOT NULL,
      service_id INT NOT NULL,
      record_id INT NULL,
      appointment_id INT NULL,
      opd_queue_id INT NULL,
      order_date DATE NOT NULL,
      priority ENUM('routine', 'urgent', 'stat') DEFAULT 'routine',
      clinical_indication TEXT NOT NULL,
      scheduled_date DATE NULL,
      scheduled_time TIME NULL,
      room_number VARCHAR(50) NULL,
      radiologist_id INT NULL,
      technician_name VARCHAR(100) NULL,
      status ENUM('ordered', 'scheduled', 'in_progress', 'completed', 'verified', 'cancelled') DEFAULT 'ordered',
      procedure_started_at DATETIME NULL,
      procedure_completed_at DATETIME NULL,
      findings LONGTEXT NULL,
      impression LONGTEXT NULL,
      recommendations TEXT NULL,
      radiation_dose VARCHAR(60) NULL,
      contrast_details VARCHAR(120) NULL,
      pacs_image_url VARCHAR(255) NULL,
      is_critical_finding TINYINT(1) DEFAULT 0,
      verified_at DATETIME NULL,
      verified_by INT NULL,
      price DECIMAL(10,2) DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES radiology_services(id) ON DELETE CASCADE,
      FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE SET NULL,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
      FOREIGN KEY (opd_queue_id) REFERENCES opd_queues(id) ON DELETE SET NULL,
      FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_rad_patient (patient_id, order_date DESC),
      INDEX idx_rad_status (status),
      INDEX idx_rad_service (service_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified radiology_orders table in MySQL.');

  // 4. Seed initial realistic radiology orders and verified reports
  const [existingOrders] = await db.query('SELECT COUNT(*) as count FROM radiology_orders');
  if (existingOrders[0].count === 0) {
    console.log('Seeding initial verified and active radiology imaging reports...');

    // Order 1: Verified Chest X-Ray for Patient 1 (Arthur)
    await db.query(`
      INSERT INTO radiology_orders 
      (order_number, patient_id, doctor_id, service_id, record_id, order_date, priority, clinical_indication, scheduled_date, scheduled_time, room_number, technician_name, status, procedure_started_at, procedure_completed_at, findings, impression, recommendations, radiation_dose, pacs_image_url, verified_at, verified_by, price)
      VALUES 
      ('RAD-2026-000101', 1, 1, 1, 14, DATE_SUB(CURDATE(), INTERVAL 14 DAY), 'routine', 'Routine post-CABG 6-month surveillance and dyspnea check.', DATE_SUB(CURDATE(), INTERVAL 14 DAY), '10:00:00', 'Radiology Suite 101', 'Sarah Jenkins, RT(R)', 'verified', 
       DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_SUB(CURDATE(), INTERVAL 14 DAY),
       'LUNGS: The lung parenchyma are well expanded and clear. No focal consolidation, pneumothorax, or pleural effusion is identified.\nHEART & MEDIASTINUM: Cardiac silhouette is normal in size (CTR < 0.50). Mediastinal contours and hila are unremarkable. Median sternotomy wires are intact and in anatomical alignment.\nPLEURA: Costophrenic sulci and cardiophrenic angles are sharp.\nBONES & SOFT TISSUES: Intact thoracic cage without acute osseous abnormality.',
       '1. Clear lung fields with no evidence of acute cardiopulmonary disease, pneumonia, or pulmonary edema.\n2. Stable post-median sternotomy appearance with intact sternal wires.',
       'Routine clinical correlation. Next surveillance in 12 months as indicated.',
       '0.02 mSv (DAP 0.12 dGy*cm²)', 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&auto=format&fit=crop&q=80',
       DATE_SUB(CURDATE(), INTERVAL 14 DAY), 1, 65.00)
    `);

    // Order 2: Verified Brain MRI for Patient 2
    await db.query(`
      INSERT INTO radiology_orders 
      (order_number, patient_id, doctor_id, service_id, order_date, priority, clinical_indication, scheduled_date, scheduled_time, room_number, technician_name, status, procedure_started_at, procedure_completed_at, findings, impression, recommendations, radiation_dose, pacs_image_url, verified_at, verified_by, price)
      VALUES 
      ('RAD-2026-000102', 2, 2, 10, DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'urgent', 'Refractory unilateral migraine with persistent visual aura. Rule out vascular anomaly or demyelination.', DATE_SUB(CURDATE(), INTERVAL 5 DAY), '14:30:00', 'MRI Unit East Wing', 'Marcus Vance, RT(MR)', 'verified',
       DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_SUB(CURDATE(), INTERVAL 5 DAY),
       'BRAIN PARENCHYMA: Multiplanar 3.0T MRI of the brain demonstrated normal parenchymal signal intensity on T1, T2, and FLAIR sequences. No acute ischemic infarct on diffusion-weighted imaging (DWI/ADC).\nVENTRICLES & CISTERNS: Ventricles, sulci, and basal cisterns are symmetric and within normal limits for age. No midline shift.\nVASCULATURE: Major intracranial flow voids of the circle of Willis are preserved. No aneurysm or arteriovenous malformation.',
       '1. Unremarkable 3.0T brain MRI with no acute intracranial pathology, mass lesion, or demyelinating process.\n2. Normal intracranial arterial flow voids.',
       'Reassuring neuroimaging findings. Recommend continued preventative headache management protocol.',
       '0.0 mSv (Non-ionizing RF)', 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop&q=80',
       DATE_SUB(CURDATE(), INTERVAL 5 DAY), 1, 450.00)
    `);

    // Order 3: Active Scheduled Abdomen Ultrasound
    await db.query(`
      INSERT INTO radiology_orders 
      (order_number, patient_id, doctor_id, service_id, order_date, priority, clinical_indication, scheduled_date, scheduled_time, room_number, status, price)
      VALUES 
      ('RAD-2026-000103', 3, 1, 4, CURDATE(), 'routine', 'Right upper quadrant postprandial discomfort. Rule out cholelithiasis or hepatic steatosis.', CURDATE(), '11:00:00', 'Ultrasound Bay 2', 'scheduled', 110.00)
    `);

    console.log('✅ Seeded 3 multi-modality radiology orders and diagnostic reports.');
  }

  console.log('🎉 Radiology & Imaging Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migrateRadiologyModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateRadiologyModule;
