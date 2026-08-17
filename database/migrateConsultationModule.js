const db = require('../server/config/db');

async function migrateConsultationModule() {
  console.log('🚀 Starting Doctor Consultation & EMR Module Database Migration...');

  // 1. Add missing columns to medical_records if not present
  const [mrCols] = await db.query('DESCRIBE medical_records');
  const existingFields = mrCols.map(c => c.Field);

  if (!existingFields.includes('symptoms')) {
    await db.query('ALTER TABLE medical_records ADD COLUMN symptoms TEXT NULL AFTER chief_complaint');
    console.log('Added symptoms column to medical_records.');
  }

  if (!existingFields.includes('physical_examination')) {
    await db.query('ALTER TABLE medical_records ADD COLUMN physical_examination TEXT NULL AFTER symptoms');
    console.log('Added physical_examination column to medical_records.');
  }

  if (!existingFields.includes('treatment_plan')) {
    await db.query('ALTER TABLE medical_records ADD COLUMN treatment_plan TEXT NULL AFTER diagnosis');
    console.log('Added treatment_plan column to medical_records.');
  }

  if (!existingFields.includes('doctor_notes')) {
    await db.query('ALTER TABLE medical_records ADD COLUMN doctor_notes TEXT NULL AFTER clinical_notes');
    console.log('Added doctor_notes column to medical_records.');
  }

  if (!existingFields.includes('encounter_type')) {
    await db.query(`ALTER TABLE medical_records ADD COLUMN encounter_type ENUM('opd', 'appointment', 'emergency', 'follow_up', 'inpatient') DEFAULT 'opd' AFTER follow_up_date`);
    console.log('Added encounter_type column to medical_records.');
  }

  if (!existingFields.includes('vitals_id')) {
    await db.query('ALTER TABLE medical_records ADD COLUMN vitals_id INT NULL AFTER encounter_type, ADD FOREIGN KEY (vitals_id) REFERENCES vitals(id) ON DELETE SET NULL');
    console.log('Added vitals_id column to medical_records.');
  }

  if (!existingFields.includes('opd_queue_id')) {
    await db.query('ALTER TABLE medical_records ADD COLUMN opd_queue_id INT NULL AFTER vitals_id, ADD FOREIGN KEY (opd_queue_id) REFERENCES opd_queues(id) ON DELETE SET NULL');
    console.log('Added opd_queue_id column to medical_records.');
  }

  // 2. Ensure prescriptions table has record_id FK
  const [rxCols] = await db.query('DESCRIBE prescriptions');
  const rxFields = rxCols.map(c => c.Field);
  if (!rxFields.includes('record_id')) {
    await db.query('ALTER TABLE prescriptions ADD COLUMN record_id INT NULL AFTER id, ADD FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE');
  }

  // 3. Seed rich chronological medical records, vitals, prescriptions, and lab tests for sample patients
  const [existingRecords] = await db.query('SELECT id FROM medical_records WHERE patient_id = 1 LIMIT 5');
  if (existingRecords.length < 3) {
    console.log('Seeding rich chronological historical EMR records for Patient 1 (Arthur Pendleton)...');

    // Past Visit 1: 3 months ago
    const [vit1] = await db.query(`
      INSERT INTO vitals (patient_id, systolic, diastolic, heart_rate, temperature, respiratory_rate, oxygen_saturation, weight_kg, height_cm, bmi, notes)
      VALUES (1, 138, 88, 80, 98.6, 16, 98, 76.5, 178, 24.1, 'Routine quarterly cardiovascular review')
    `);

    const [mr1] = await db.query(`
      INSERT INTO medical_records 
      (patient_id, doctor_id, record_date, chief_complaint, symptoms, physical_examination, diagnosis, treatment_plan, clinical_notes, doctor_notes, follow_up_date, encounter_type, vitals_id, vitals_json)
      VALUES (?, ?, DATE_SUB(CURDATE(), INTERVAL 90 DAY), ?, ?, ?, ?, ?, ?, ?, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 'appointment', ?, ?)
    `, [
      1, 1,
      'Quarterly post-CABG and hypertension management follow-up',
      'Mild exertional dyspnea when climbing two flights of stairs. Denies angina, palpitations, or ankle edema.',
      'Chest: Well-healed midline sternotomy scar. Lungs: Clear to auscultation bilaterally. Heart: Regular rate and rhythm, S1/S2 normal, no murmurs.',
      'Stage 1 Essential Hypertension (ICD-10 I10) & Post-Coronary Artery Bypass Graft status (Z95.1)',
      '1. Continue lifestyle modifications (low sodium DASH diet, 30 min daily walking).\n2. Adjust Amlodipine to 10mg daily.\n3. Recheck lipid panel and fasting glucose in 60 days.',
      'Patient is compliant with medications. Blood pressure slightly elevated at 138/88.',
      'Counselled patient on sodium restriction. Exercise tolerance remains acceptable.',
      vit1.insertId,
      JSON.stringify({ systolic: 138, diastolic: 88, heart_rate: 80, temperature: 98.6, bmi: 24.1, oxygen_saturation: 98 })
    ]);

    // Prescriptions for Visit 1
    await db.query(`
      INSERT INTO prescriptions (record_id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, instructions)
      VALUES 
      (?, 1, 1, 'Amlodipine Besylate', '10 mg', 'Once daily (morning)', '90 days', 'Take with water after breakfast'),
      (?, 1, 1, 'Atorvastatin Calcium', '40 mg', 'Once daily (bedtime)', '90 days', 'Take at bedtime. Report any muscle pain immediately'),
      (?, 1, 1, 'Aspirin (Ecotrin)', '81 mg', 'Once daily', '90 days', 'Take with food to prevent gastric irritation')
    `, [mr1.insertId, mr1.insertId, mr1.insertId]);

    // Past Visit 2: 1 month ago
    const [vit2] = await db.query(`
      INSERT INTO vitals (patient_id, systolic, diastolic, heart_rate, temperature, respiratory_rate, oxygen_saturation, weight_kg, height_cm, bmi, notes)
      VALUES (1, 126, 82, 74, 98.4, 15, 99, 75.8, 178, 23.9, 'Follow-up BP check')
    `);

    const [mr2] = await db.query(`
      INSERT INTO medical_records 
      (patient_id, doctor_id, record_date, chief_complaint, symptoms, physical_examination, diagnosis, treatment_plan, clinical_notes, doctor_notes, follow_up_date, encounter_type, vitals_id, vitals_json)
      VALUES (?, ?, DATE_SUB(CURDATE(), INTERVAL 30 DAY), ?, ?, ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 60 DAY), 'opd', ?, ?)
    `, [
      1, 1,
      'Follow-up blood pressure evaluation after Amlodipine dosage adjustment',
      'Feeling significantly better. Exertional fatigue reduced. No dizziness or peripheral edema.',
      'Blood pressure well-controlled at 126/82. Normal peripheral pulses. No peripheral edema.',
      'Well-Controlled Essential Hypertension (ICD-10 I10)',
      '1. Maintain current pharmacotherapy regimen.\n2. Scheduled for routine echocardiogram in 6 months.',
      'Excellent response to 10mg Amlodipine regimen. Patient logs home BP at average 122/78.',
      'Patient adhering strictly to DASH diet. Blood pressure target achieved.',
      vit2.insertId,
      JSON.stringify({ systolic: 126, diastolic: 82, heart_rate: 74, temperature: 98.4, bmi: 23.9, oxygen_saturation: 99 })
    ]);

    await db.query(`
      INSERT INTO prescriptions (record_id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, instructions)
      VALUES 
      (?, 1, 1, 'Amlodipine Besylate', '10 mg', 'Once daily (morning)', '60 days', 'Continue morning dose'),
      (?, 1, 1, 'Atorvastatin Calcium', '40 mg', 'Once daily (bedtime)', '60 days', 'Continue bedtime dose')
    `, [mr2.insertId, mr2.insertId]);

    console.log('✅ Seeded historical EMR encounters and prescriptions for Patient 1.');
  }

  // Seed sample lab tests and orders if empty
  const [labTests] = await db.query('SELECT id FROM lab_tests LIMIT 1');
  if (labTests.length === 0) {
    console.log('Seeding standard clinical diagnostic lab catalog...');
    await db.query(`
      INSERT INTO lab_tests (test_code, name, category, price, normal_range, unit) VALUES
      ('CBC', 'Complete Blood Count with Differential', 'Hematology', 35.00, 'WBC: 4.5-11.0, RBC: 4.3-5.9', '10^3/uL'),
      ('LIPID', 'Comprehensive Lipid Panel', 'Biochemistry', 45.00, 'Cholesterol < 200, LDL < 100, HDL > 40', 'mg/dL'),
      ('BMP', 'Basic Metabolic Panel', 'Biochemistry', 40.00, 'Glucose: 70-99, BUN: 7-20, Cr: 0.7-1.3', 'mg/dL'),
      ('HBA1C', 'Glycated Hemoglobin (HbA1c)', 'Endocrinology', 30.00, '< 5.7% Normal, 5.7-6.4% Prediabetic', '%'),
      ('TROP-I', 'High-Sensitivity Troponin I', 'Cardiology', 55.00, '< 0.04', 'ng/mL'),
      ('CXR', 'Chest Radiograph (PA & Lateral)', 'Radiology', 65.00, 'Normal lung fields and cardiac silhouette', 'visual')
    `);
    console.log('✅ Seeded diagnostic lab test catalog.');
  }

  // Seed historical lab orders for patient 1
  const [patOrders] = await db.query('SELECT id FROM lab_orders WHERE patient_id = 1 LIMIT 1');
  if (patOrders.length === 0) {
    console.log('Seeding historical lab reports for Patient 1...');
    await db.query(`
      INSERT INTO lab_orders 
      (order_number, patient_id, doctor_id, test_id, order_date, sample_type, sample_collected_at, result_value, result_notes, status, completed_at)
      VALUES 
      ('LAB-2026-00101', 1, 1, 2, DATE_SUB(CURDATE(), INTERVAL 90 DAY), 'Serum Blood', DATE_SUB(CURDATE(), INTERVAL 90 DAY), 'Total Chol: 172 mg/dL, HDL: 48 mg/dL, LDL: 88 mg/dL, Triglycerides: 142 mg/dL', 'Lipid levels optimal on 40mg Atorvastatin.', 'completed', DATE_SUB(CURDATE(), INTERVAL 89 DAY)),
      ('LAB-2026-00102', 1, 1, 1, DATE_SUB(CURDATE(), INTERVAL 90 DAY), 'Whole Blood (EDTA)', DATE_SUB(CURDATE(), INTERVAL 90 DAY), 'WBC: 6.8 x10^3/uL, Hemoglobin: 14.8 g/dL, Platelets: 240 x10^3/uL', 'Hematological profile within normal physiological limits.', 'completed', DATE_SUB(CURDATE(), INTERVAL 89 DAY))
    `);
    console.log('✅ Seeded completed lab reports for Patient 1.');
  }

  console.log('🎉 Doctor Consultation & EMR Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migrateConsultationModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateConsultationModule;
