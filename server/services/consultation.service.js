const db = require('../config/db');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Get Comprehensive Longitudinal Clinical Summary & EMR for a Patient
 */
async function getPatientClinicalSummary(patientId, actorUser = null) {
  // 1. Fetch Patient Demographics & Alerts
  const [patRows] = await db.query(
    `SELECT 
      id, user_id, patient_code, first_name, last_name, gender, date_of_birth,
      blood_group, phone, email, address, emergency_contact_name, emergency_contact_phone,
      emergency_contact_relation, allergies, medical_history, registration_date,
      profile_image, marital_status, occupation, insurance_provider, insurance_policy_number
     FROM patients 
     WHERE id = ?`,
    [patientId]
  );

  if (patRows.length === 0) {
    throw new NotFoundError('Patient not found.');
  }
  const patient = patRows[0];

  // Role-based Access Control: Patient can only view their own record
  if (actorUser && actorUser.role === 'patient' && patient.user_id !== actorUser.id) {
    throw new ForbiddenError('You are not authorized to view this clinical medical record.');
  }

  // Calculate age
  let age = null;
  if (patient.date_of_birth) {
    const dob = new Date(patient.date_of_birth);
    const diff = Date.now() - dob.getTime();
    age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
  }

  // 2. Fetch Chronological Previous Visits / Medical Records (Never overwritten, strictly chronological)
  const [encounters] = await db.query(
    `SELECT 
      mr.id,
      mr.patient_id,
      mr.doctor_id,
      mr.appointment_id,
      mr.opd_queue_id,
      mr.record_date,
      mr.chief_complaint,
      mr.symptoms,
      mr.physical_examination,
      mr.diagnosis,
      mr.treatment_plan,
      mr.clinical_notes,
      mr.doctor_notes,
      mr.follow_up_date,
      mr.encounter_type,
      mr.vitals_id,
      mr.vitals_json,
      mr.created_at,
      u_doc.full_name as doctor_name,
      doc.doctor_code,
      doc.specialization as doctor_specialization,
      dept.name as department_name,
      dept.code as department_code,
      v.systolic,
      v.diastolic,
      v.heart_rate,
      v.temperature,
      v.respiratory_rate,
      v.oxygen_saturation,
      v.weight_kg,
      v.height_cm,
      v.bmi
    FROM medical_records mr
    JOIN doctors doc ON mr.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    LEFT JOIN departments dept ON doc.department_id = dept.id
    LEFT JOIN vitals v ON mr.vitals_id = v.id
    WHERE mr.patient_id = ?
    ORDER BY mr.record_date DESC, mr.created_at DESC`,
    [patientId]
  );

  // Attach prescriptions to each encounter
  const encounterIds = encounters.map(e => e.id);
  let allEncounterRx = [];
  if (encounterIds.length > 0) {
    const [rxRows] = await db.query(
      `SELECT * FROM prescriptions WHERE record_id IN (${encounterIds.join(',')}) ORDER BY id ASC`
    );
    allEncounterRx = rxRows;
  }

  const visitsWithDetails = encounters.map(enc => {
    let parsedVitals = null;
    if (enc.systolic || enc.heart_rate || enc.bmi) {
      parsedVitals = {
        systolic: enc.systolic ? parseInt(enc.systolic, 10) : null,
        diastolic: enc.diastolic ? parseInt(enc.diastolic, 10) : null,
        heart_rate: enc.heart_rate ? parseInt(enc.heart_rate, 10) : null,
        temperature: enc.temperature ? parseFloat(enc.temperature) : null,
        respiratory_rate: enc.respiratory_rate ? parseInt(enc.respiratory_rate, 10) : null,
        oxygen_saturation: enc.oxygen_saturation ? parseInt(enc.oxygen_saturation, 10) : null,
        weight_kg: enc.weight_kg ? parseFloat(enc.weight_kg) : null,
        height_cm: enc.height_cm ? parseFloat(enc.height_cm) : null,
        bmi: enc.bmi ? parseFloat(enc.bmi) : null
      };
    } else if (enc.vitals_json) {
      try { parsedVitals = JSON.parse(enc.vitals_json); } catch (_) {}
    }

    return {
      ...enc,
      vitals: parsedVitals,
      prescriptions: allEncounterRx.filter(rx => rx.record_id === enc.id)
    };
  });

  // 3. Aggregate Previous Diagnoses List (Chronological & Distinct)
  const previousDiagnoses = [];
  const diagMap = new Map();
  encounters.forEach(e => {
    if (e.diagnosis && e.diagnosis.trim().length > 0) {
      const dClean = e.diagnosis.trim();
      if (!diagMap.has(dClean)) {
        diagMap.set(dClean, {
          diagnosis: dClean,
          most_recent_date: e.record_date,
          first_diagnosed_date: e.record_date,
          diagnosed_by_doctor: e.doctor_name,
          encounter_count: 1
        });
      } else {
        const item = diagMap.get(dClean);
        item.first_diagnosed_date = e.record_date; // earlier encounter because sorted DESC
        item.encounter_count += 1;
      }
    }
  });
  diagMap.forEach(val => previousDiagnoses.push(val));

  // 4. Chronological All Previous Prescriptions Archive
  const [allPrescriptions] = await db.query(
    `SELECT 
      rx.id,
      rx.record_id,
      rx.patient_id,
      rx.doctor_id,
      rx.medicine_name,
      rx.dosage,
      rx.frequency,
      rx.duration,
      rx.instructions,
      rx.created_at,
      u_doc.full_name as prescribed_by,
      mr.record_date
    FROM prescriptions rx
    JOIN doctors doc ON rx.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    LEFT JOIN medical_records mr ON rx.record_id = mr.id
    WHERE rx.patient_id = ?
    ORDER BY rx.created_at DESC`,
    [patientId]
  );

  // 5. Chronological Previous Lab Reports
  const [labReports] = await db.query(
    `SELECT 
      lo.id,
      lo.order_number,
      lo.patient_id,
      lo.doctor_id,
      lo.test_id,
      lo.order_date,
      lo.sample_type,
      lo.sample_collected_at,
      lo.result_value,
      lo.result_notes,
      lo.status,
      lo.completed_at,
      lo.created_at,
      lt.name as test_name,
      lt.code as test_code,
      lt.category as test_category,
      lt.normal_range,
      lt.unit,
      u_doc.full_name as ordering_doctor
    FROM lab_orders lo
    JOIN lab_tests lt ON lo.test_id = lt.id
    LEFT JOIN doctors doc ON lo.doctor_id = doc.id
    LEFT JOIN users u_doc ON doc.user_id = u_doc.id
    WHERE lo.patient_id = ?
    ORDER BY lo.order_date DESC, lo.created_at DESC`,
    [patientId]
  );

  // 6. Latest Recorded Vitals
  const [latestVitalsRows] = await db.query(
    'SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 1',
    [patientId]
  );
  const latestVitals = latestVitalsRows.length > 0 ? latestVitalsRows[0] : null;

  return {
    patient: {
      ...patient,
      full_name: `${patient.first_name} ${patient.last_name}`,
      age
    },
    allergies: patient.allergies ? patient.allergies.split(',').map(a => a.trim()).filter(Boolean) : [],
    allergies_raw: patient.allergies || 'No known drug allergies (NKDA)',
    has_allergies: !!(patient.allergies && patient.allergies.trim().length > 0 && !patient.allergies.toLowerCase().includes('nkda') && !patient.allergies.toLowerCase().includes('none')),
    medical_history: patient.medical_history || 'No significant chronic medical history documented',
    previous_visits_count: visitsWithDetails.length,
    previous_visits: visitsWithDetails,
    previous_diagnoses: previousDiagnoses,
    previous_prescriptions: allPrescriptions,
    previous_lab_reports: labReports,
    latest_vitals: latestVitals
  };
}

/**
 * Save Traceable, Non-Overwriting Doctor Consultation & EMR Encounter
 */
async function saveConsultationRecord(data, actorUser = null) {
  return await db.withTransaction(async (conn) => {
    // 1. Resolve Doctor ID
    let doctorId = data.doctor_id || null;
    if (!doctorId && actorUser && actorUser.role === 'doctor') {
      const [doc] = await conn.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [actorUser.id]);
      if (doc.length > 0) doctorId = doc[0].id;
    }
    if (!doctorId) {
      const [firstDoc] = await conn.query('SELECT id FROM doctors LIMIT 1');
      if (firstDoc.length > 0) doctorId = firstDoc[0].id;
    }
    if (!doctorId) throw new NotFoundError('Doctor record not found.');

    const patientId = parseInt(data.patient_id, 10);

    // Verify patient exists
    const [pat] = await conn.query('SELECT id, first_name, last_name FROM patients WHERE id = ?', [patientId]);
    if (pat.length === 0) throw new NotFoundError('Patient not found.');

    // 2. Process Vitals (Insert into vitals table & calculate BMI)
    let vitalsId = null;
    let vitalsJsonStr = null;
    if (data.vitals) {
      const v = data.vitals;
      let bmi = null;
      if (v.weight_kg && v.height_cm) {
        const hm = v.height_cm / 100;
        bmi = parseFloat((v.weight_kg / (hm * hm)).toFixed(1));
      }

      if (v.systolic || v.heart_rate || v.temperature || v.weight_kg) {
        const [vitRes] = await conn.query(
          `INSERT INTO vitals 
           (patient_id, systolic, diastolic, heart_rate, temperature, respiratory_rate, oxygen_saturation, weight_kg, height_cm, bmi, notes, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            patientId,
            v.systolic || null,
            v.diastolic || null,
            v.heart_rate || null,
            v.temperature || null,
            v.respiratory_rate || null,
            v.oxygen_saturation || null,
            v.weight_kg || null,
            v.height_cm || null,
            bmi,
            v.notes || 'Consultation encounter vitals',
            actorUser ? actorUser.id : null
          ]
        );
        vitalsId = vitRes.insertId;
        vitalsJsonStr = JSON.stringify({ ...v, bmi });
      }
    }

    // 3. Insert Traceable Medical Record (NEVER overwrites historical records)
    const [mrRes] = await conn.query(
      `INSERT INTO medical_records 
       (patient_id, doctor_id, appointment_id, opd_queue_id, record_date, chief_complaint, symptoms, physical_examination, diagnosis, treatment_plan, clinical_notes, doctor_notes, follow_up_date, encounter_type, vitals_id, vitals_json)
       VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        doctorId,
        data.appointment_id || null,
        data.opd_queue_id || null,
        data.chief_complaint.trim(),
        data.symptoms ? data.symptoms.trim() : null,
        data.physical_examination ? data.physical_examination.trim() : null,
        data.diagnosis.trim(),
        data.treatment_plan ? data.treatment_plan.trim() : null,
        data.clinical_notes ? data.clinical_notes.trim() : null,
        data.doctor_notes ? data.doctor_notes.trim() : null,
        data.follow_up_date || null,
        data.encounter_type || 'opd',
        vitalsId,
        vitalsJsonStr
      ]
    );
    const newRecordId = mrRes.insertId;

    // 4. Save e-Prescriptions if attached
    const savedPrescriptions = [];
    if (data.prescriptions && Array.isArray(data.prescriptions) && data.prescriptions.length > 0) {
      for (const rx of data.prescriptions) {
        if (rx.medicine_name && rx.medicine_name.trim().length > 0) {
          const [rxRes] = await conn.query(
            `INSERT INTO prescriptions 
             (record_id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, instructions)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newRecordId,
              patientId,
              doctorId,
              rx.medicine_name.trim(),
              rx.dosage ? rx.dosage.trim() : 'As directed',
              rx.frequency ? rx.frequency.trim() : 'Once daily',
              rx.duration ? rx.duration.trim() : '7 days',
              rx.instructions ? rx.instructions.trim() : null
            ]
          );
          savedPrescriptions.push({ id: rxRes.insertId, medicine_name: rx.medicine_name });
        }
      }
    }

    // 5. Save Diagnostic Lab Orders if attached
    const savedLabOrders = [];
    if (data.lab_tests && Array.isArray(data.lab_tests) && data.lab_tests.length > 0) {
      for (const testId of data.lab_tests) {
        const orderNum = `LAB-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
        const [loRes] = await conn.query(
          `INSERT INTO lab_orders 
           (order_number, patient_id, doctor_id, test_id, order_date, sample_type, status)
           VALUES (?, ?, ?, ?, CURDATE(), 'Blood / Routine', 'pending')`,
          [orderNum, patientId, doctorId, testId]
        );
        savedLabOrders.push({ id: loRes.insertId, order_number: orderNum });
      }
    }

    // 6. Connect with OPD Queue if linked
    let invoiceId = null;
    let invoiceNumber = null;
    if (data.opd_queue_id) {
      const [docInfo] = await conn.query('SELECT consultation_fee FROM doctors WHERE id = ?', [doctorId]);
      const fee = data.fee_override !== undefined ? parseFloat(data.fee_override) : parseFloat(docInfo[0]?.consultation_fee || 50);
      invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      const [invRes] = await conn.query(
        `INSERT INTO invoices 
         (invoice_number, patient_id, appointment_id, total_amount, discount_amount, tax_amount, net_amount, status, due_date)
         VALUES (?, ?, ?, ?, 0.00, 0.00, ?, 'unpaid', CURDATE())`,
        [
          invoiceNumber,
          patientId,
          data.appointment_id || null,
          fee,
          fee
        ]
      );
      invoiceId = invRes.insertId;

      await conn.query(
        `UPDATE opd_queues 
         SET status = 'completed', 
             consultation_end_time = NOW(), 
             completed_time = NOW(), 
             medical_record_id = ?, 
             invoice_id = ? 
         WHERE id = ?`,
        [newRecordId, invoiceId, data.opd_queue_id]
      );
    }

    // 7. Connect with Appointments if linked
    if (data.appointment_id) {
      await conn.query(
        `UPDATE appointments 
         SET status = 'completed', 
             consultation_end_time = NOW() 
         WHERE id = ?`,
        [data.appointment_id]
      );
    }

    return {
      id: newRecordId,
      patient_id: patientId,
      doctor_id: doctorId,
      record_date: new Date().toISOString().split('T')[0],
      prescriptions_count: savedPrescriptions.length,
      lab_orders_count: savedLabOrders.length,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      message: 'Consultation concluded and chronological EMR record saved successfully.'
    };
  });
}

/**
 * Get Specific Medical Record by ID with Attached Details
 */
async function getMedicalRecordById(recordId, actorUser = null) {
  const [rows] = await db.query(
    `SELECT 
      mr.*,
      p.patient_code,
      CONCAT(p.first_name, ' ', p.last_name) as patient_name,
      p.gender as patient_gender,
      p.date_of_birth as patient_dob,
      p.blood_group as patient_blood_group,
      p.allergies as patient_allergies,
      doc.doctor_code,
      u_doc.full_name as doctor_name,
      doc.specialization as doctor_specialization,
      dept.name as department_name
    FROM medical_records mr
    JOIN patients p ON mr.patient_id = p.id
    JOIN doctors doc ON mr.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    LEFT JOIN departments dept ON doc.department_id = dept.id
    WHERE mr.id = ?`,
    [recordId]
  );

  if (rows.length === 0) throw new NotFoundError('Medical record not found.');
  const record = rows[0];

  if (actorUser && actorUser.role === 'patient') {
    const [pat] = await db.query('SELECT user_id FROM patients WHERE id = ?', [record.patient_id]);
    if (pat.length > 0 && pat[0].user_id !== actorUser.id) {
      throw new ForbiddenError('Access to this medical chart is restricted.');
    }
  }

  const [prescriptions] = await db.query('SELECT * FROM prescriptions WHERE record_id = ?', [recordId]);

  return {
    ...record,
    prescriptions
  };
}

module.exports = {
  getPatientClinicalSummary,
  saveConsultationRecord,
  getMedicalRecordById
};
