const db = require('../config/db');
const { BadRequestError, NotFoundError } = require('../utils/errors');

/**
 * Generate Guaranteed Unique & Concurrency-Safe Daily OPD Token
 */
async function generateSafeOpdToken(departmentId, queueDate, conn) {
  const [deptRows] = await conn.query('SELECT code, name FROM departments WHERE id = ?', [departmentId]);
  if (deptRows.length === 0) {
    throw new NotFoundError('Department not found for token generation.');
  }
  const deptCode = deptRows[0].code || 'OPD';

  const [seqResult] = await conn.query(
    `SELECT IFNULL(MAX(token_sequence), 0) + 1 as next_seq 
     FROM opd_queues 
     WHERE department_id = ? AND queue_date = ? FOR UPDATE`,
    [departmentId, queueDate]
  );

  const nextSeq = seqResult[0].next_seq;
  const tokenNumber = `${deptCode}-${String(nextSeq).padStart(3, '0')}`;

  return { tokenNumber, tokenSequence: nextSeq };
}

/**
 * Get Real-Time OPD Live Queue Dashboard Data
 */
async function getOpdDashboard(filters = {}, actorUser = null) {
  const todayStr = filters.date || new Date().toISOString().split('T')[0];
  const { department_id, doctor_id, search } = filters;

  const conditions = ['q.queue_date = ?'];
  const params = [todayStr];

  // Role scoping
  if (actorUser && actorUser.role === 'doctor') {
    const [doc] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [actorUser.id]);
    if (doc.length > 0) {
      conditions.push('q.doctor_id = ?');
      params.push(doc[0].id);
    }
  } else if (doctor_id) {
    conditions.push('q.doctor_id = ?');
    params.push(doctor_id);
  }

  if (department_id) {
    conditions.push('q.department_id = ?');
    params.push(department_id);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push(`(
      q.token_number LIKE ? OR
      p.first_name LIKE ? OR
      p.last_name LIKE ? OR
      CONCAT(p.first_name, ' ', p.last_name) LIKE ? OR
      p.patient_code LIKE ? OR
      p.phone LIKE ? OR
      u_doc.full_name LIKE ?
    )`);
    params.push(term, term, term, term, term, term, term);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const sql = `
    SELECT 
      q.id,
      q.token_number,
      q.token_sequence,
      q.queue_date,
      q.patient_id,
      q.doctor_id,
      q.department_id,
      q.appointment_id,
      q.patient_type,
      q.priority,
      q.status,
      q.vitals_id,
      q.chief_complaint,
      q.triage_notes,
      q.check_in_time,
      q.called_time,
      q.consultation_start_time,
      q.consultation_end_time,
      q.completed_time,
      q.invoice_id,
      q.medical_record_id,
      p.patient_code,
      CONCAT(p.first_name, ' ', p.last_name) as patient_name,
      p.gender as patient_gender,
      p.phone as patient_phone,
      p.blood_group as patient_blood_group,
      p.allergies as patient_allergies,
      p.date_of_birth as patient_dob,
      doc.doctor_code,
      u_doc.full_name as doctor_name,
      doc.specialization as doctor_specialization,
      doc.room_number as doctor_room,
      doc.consultation_fee,
      dept.name as department_name,
      dept.code as department_code,
      v.systolic,
      v.diastolic,
      v.heart_rate,
      v.temperature,
      v.oxygen_saturation,
      v.bmi,
      inv.invoice_number,
      inv.net_amount as invoice_amount,
      inv.status as invoice_status
    FROM opd_queues q
    JOIN patients p ON q.patient_id = p.id
    JOIN doctors doc ON q.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    JOIN departments dept ON q.department_id = dept.id
    LEFT JOIN vitals v ON q.vitals_id = v.id
    LEFT JOIN invoices inv ON q.invoice_id = inv.id
    ${whereClause}
    ORDER BY 
      FIELD(q.priority, 'emergency', 'urgent', 'normal'),
      q.token_sequence ASC
  `;

  const [rows] = await db.query(sql, params);

  // Group into status categories
  const waiting = rows.filter(r => r.status === 'waiting');
  const in_consultation = rows.filter(r => r.status === 'in_consultation');
  const completed = rows.filter(r => r.status === 'completed');
  const no_show = rows.filter(r => r.status === 'no_show');

  return {
    queue_date: todayStr,
    stats: {
      total: rows.length,
      waiting: waiting.length,
      in_consultation: in_consultation.length,
      completed: completed.length,
      no_show: no_show.length
    },
    waiting,
    in_consultation,
    completed,
    no_show,
    all_queue: rows
  };
}

/**
 * Register Walk-In Patient & Generate Live OPD Token
 */
async function registerWalkInPatient(data, actorUser = null) {
  const queueDate = new Date().toISOString().split('T')[0];

  return await db.withTransaction(async (conn) => {
    // 1. Resolve or register patient
    let patientId = data.patient_id || null;
    if (!patientId) {
      const phone = (data.phone || '').trim();
      const [existingPat] = await conn.query('SELECT id FROM patients WHERE phone = ? LIMIT 1', [phone]);
      if (existingPat.length > 0) {
        patientId = existingPat[0].id;
      } else {
        const patientCode = `PAT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        const [newPat] = await conn.query(
          `INSERT INTO patients (patient_code, first_name, last_name, gender, date_of_birth, phone, email, address, blood_group, allergies)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            patientCode,
            data.first_name.trim(),
            data.last_name.trim(),
            data.gender || 'other',
            data.date_of_birth || '1995-01-01',
            phone,
            data.email || null,
            data.address || null,
            data.blood_group || null,
            data.allergies || null
          ]
        );
        patientId = newPat.insertId;
      }
    }

    // 2. Validate department & doctor
    const [depts] = await conn.query('SELECT id, name FROM departments WHERE id = ?', [data.department_id]);
    if (depts.length === 0) throw new NotFoundError('Selected department not found.');

    const [docs] = await conn.query('SELECT id FROM doctors WHERE id = ?', [data.doctor_id]);
    if (docs.length === 0) throw new NotFoundError('Selected doctor not found.');

    // 3. Optional: Capture triage vitals
    let vitalsId = null;
    if (data.vitals && (data.vitals.systolic || data.vitals.heart_rate || data.vitals.temperature)) {
      const v = data.vitals;
      let bmi = null;
      if (v.weight_kg && v.height_cm) {
        const hMeter = v.height_cm / 100;
        bmi = parseFloat((v.weight_kg / (hMeter * hMeter)).toFixed(1));
      }

      const [newVit] = await conn.query(
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
          v.notes || 'OPD Walk-in triage',
          actorUser ? actorUser.id : null
        ]
      );
      vitalsId = newVit.insertId;
    }

    // 4. Generate guaranteed unique sequential token
    const { tokenNumber, tokenSequence } = await generateSafeOpdToken(data.department_id, queueDate, conn);

    // 5. Insert into opd_queues
    const [queueResult] = await conn.query(
      `INSERT INTO opd_queues 
       (token_number, token_sequence, queue_date, patient_id, doctor_id, department_id, patient_type, priority, status, vitals_id, chief_complaint, triage_notes, check_in_time, assigned_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?, NOW(), ?)`,
      [
        tokenNumber,
        tokenSequence,
        queueDate,
        patientId,
        data.doctor_id,
        data.department_id,
        data.patient_type || 'walk_in',
        data.priority || 'normal',
        vitalsId,
        data.chief_complaint || 'Walk-in outpatient consultation',
        data.triage_notes || null,
        actorUser ? actorUser.id : null
      ]
    );

    const newQueueId = queueResult.insertId;

    return {
      id: newQueueId,
      tokenNumber,
      tokenSequence,
      queueDate,
      patientId,
      status: 'waiting',
      message: `Token ${tokenNumber} issued successfully.`
    };
  });
}

/**
 * Check-In Scheduled Appointment & Generate Live OPD Token
 */
async function checkInAppointment(appointmentId, actorUser = null) {
  const queueDate = new Date().toISOString().split('T')[0];

  return await db.withTransaction(async (conn) => {
    // 1. Fetch appointment
    const [appts] = await conn.query('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
    if (appts.length === 0) throw new NotFoundError('Appointment not found.');
    const appt = appts[0];

    // Check if already in today's queue
    const [existingQ] = await conn.query(
      'SELECT id, token_number FROM opd_queues WHERE appointment_id = ? AND queue_date = ? LIMIT 1',
      [appointmentId, queueDate]
    );
    if (existingQ.length > 0) {
      return {
        id: existingQ[0].id,
        tokenNumber: existingQ[0].token_number,
        message: `Patient already checked-in with token ${existingQ[0].token_number}.`
      };
    }

    // 2. Generate safe token for the department
    const { tokenNumber, tokenSequence } = await generateSafeOpdToken(appt.department_id, queueDate, conn);

    // 3. Insert into opd_queues
    const [queueResult] = await conn.query(
      `INSERT INTO opd_queues 
       (token_number, token_sequence, queue_date, patient_id, doctor_id, department_id, appointment_id, patient_type, priority, status, chief_complaint, check_in_time, assigned_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'appointment', 'normal', 'waiting', ?, NOW(), ?)`,
      [
        tokenNumber,
        tokenSequence,
        queueDate,
        appt.patient_id,
        appt.doctor_id,
        appt.department_id,
        appt.id,
        appt.reason || 'Scheduled outpatient appointment',
        actorUser ? actorUser.id : null
      ]
    );

    // 4. Update appointment status to checked_in
    await conn.query(
      'UPDATE appointments SET status = "checked_in", check_in_time = NOW() WHERE id = ?',
      [appointmentId]
    );

    return {
      id: queueResult.insertId,
      tokenNumber,
      tokenSequence,
      status: 'waiting',
      message: `Appointment checked in. Token ${tokenNumber} issued.`
    };
  });
}

/**
 * Record / Update Triage Vitals for a Queued Patient
 */
async function recordTriageVitals(queueId, vitalsData, actorUser = null) {
  const [qRows] = await db.query('SELECT patient_id FROM opd_queues WHERE id = ?', [queueId]);
  if (qRows.length === 0) throw new NotFoundError('OPD queue record not found.');
  const patientId = qRows[0].patient_id;

  let bmi = null;
  if (vitalsData.weight_kg && vitalsData.height_cm) {
    const hMeter = vitalsData.height_cm / 100;
    bmi = parseFloat((vitalsData.weight_kg / (hMeter * hMeter)).toFixed(1));
  }

  const [vitResult] = await db.query(
    `INSERT INTO vitals 
     (patient_id, systolic, diastolic, heart_rate, temperature, respiratory_rate, oxygen_saturation, weight_kg, height_cm, bmi, notes, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      patientId,
      vitalsData.systolic || null,
      vitalsData.diastolic || null,
      vitalsData.heart_rate || null,
      vitalsData.temperature || null,
      vitalsData.respiratory_rate || null,
      vitalsData.oxygen_saturation || null,
      vitalsData.weight_kg || null,
      vitalsData.height_cm || null,
      bmi,
      vitalsData.notes || 'OPD triage vitals',
      actorUser ? actorUser.id : null
    ]
  );

  const vitalsId = vitResult.insertId;
  await db.query('UPDATE opd_queues SET vitals_id = ? WHERE id = ?', [vitalsId, queueId]);

  return {
    vitals_id: vitalsId,
    bmi,
    message: 'Triage vitals recorded and linked to queue entry.'
  };
}

/**
 * Call Patient into Consultation Room
 */
async function callPatient(queueId, actorUser = null) {
  const [qRows] = await db.query('SELECT appointment_id, token_number FROM opd_queues WHERE id = ?', [queueId]);
  if (qRows.length === 0) throw new NotFoundError('Queue record not found.');
  const q = qRows[0];

  await db.query(
    `UPDATE opd_queues 
     SET status = 'in_consultation', 
         called_time = NOW(), 
         consultation_start_time = NOW() 
     WHERE id = ?`,
    [queueId]
  );

  if (q.appointment_id) {
    await db.query(
      'UPDATE appointments SET status = "in_progress", consultation_start_time = NOW() WHERE id = ?',
      [q.appointment_id]
    );
  }

  return {
    id: queueId,
    token_number: q.token_number,
    status: 'in_consultation',
    message: `Patient ${q.token_number} called into consultation.`
  };
}

/**
 * Complete Consultation & Connect with Medical Records & Billing
 */
async function completeConsultation(queueId, completionData, actorUser = null) {
  const { diagnosis, clinical_notes, follow_up_date, fee_override } = completionData;

  return await db.withTransaction(async (conn) => {
    // 1. Fetch queue record with patient and doctor details
    const [qRows] = await conn.query(
      `SELECT q.*, doc.consultation_fee, u_doc.full_name as doctor_name
       FROM opd_queues q
       JOIN doctors doc ON q.doctor_id = doc.id
       JOIN users u_doc ON doc.user_id = u_doc.id
       WHERE q.id = ?`,
      [queueId]
    );
    if (qRows.length === 0) throw new NotFoundError('Queue record not found.');
    const q = qRows[0];

    // 2. Create Electronic Medical Record (EMR)
    const [mrResult] = await conn.query(
      `INSERT INTO medical_records 
       (patient_id, doctor_id, appointment_id, record_date, chief_complaint, diagnosis, clinical_notes, follow_up_date)
       VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?)`,
      [
        q.patient_id,
        q.doctor_id,
        q.appointment_id || null,
        q.chief_complaint || 'OPD Encounter',
        diagnosis,
        clinical_notes || null,
        follow_up_date || null
      ]
    );
    const medicalRecordId = mrResult.insertId;

    // 3. Generate Billing Invoice for Consultation
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const fee = fee_override !== undefined ? parseFloat(fee_override) : parseFloat(q.consultation_fee || 50);

    const [invResult] = await conn.query(
      `INSERT INTO invoices 
       (invoice_number, patient_id, appointment_id, total_amount, discount_amount, tax_amount, net_amount, status, due_date)
       VALUES (?, ?, ?, ?, 0.00, 0.00, ?, 'unpaid', CURDATE())`,
      [
        invoiceNumber,
        q.patient_id,
        q.appointment_id || null,
        fee,
        fee
      ]
    );
    const invoiceId = invResult.insertId;

    // 4. Update OPD Queue Entry
    await conn.query(
      `UPDATE opd_queues 
       SET status = 'completed', 
         consultation_end_time = NOW(), 
         completed_time = NOW(),
         medical_record_id = ?,
         invoice_id = ?
       WHERE id = ?`,
      [medicalRecordId, invoiceId, queueId]
    );

    // 5. Update linked appointment if any
    if (q.appointment_id) {
      await conn.query(
        'UPDATE appointments SET status = "completed", consultation_end_time = NOW() WHERE id = ?',
        [q.appointment_id]
      );
    }

    return {
      id: queueId,
      token_number: q.token_number,
      status: 'completed',
      medical_record_id: medicalRecordId,
      invoice_id: invoiceId,
      invoice_number: invoiceNumber,
      net_amount: fee,
      message: `Encounter completed. EMR created and invoice ${invoiceNumber} generated.`
    };
  });
}

/**
 * Mark OPD Patient as No-Show
 */
async function markOpdNoShow(queueId, actorUser = null) {
  const [qRows] = await db.query('SELECT appointment_id, token_number FROM opd_queues WHERE id = ?', [queueId]);
  if (qRows.length === 0) throw new NotFoundError('Queue record not found.');
  const q = qRows[0];

  await db.query('UPDATE opd_queues SET status = "no_show" WHERE id = ?', [queueId]);

  if (q.appointment_id) {
    await db.query('UPDATE appointments SET status = "no_show" WHERE id = ?', [q.appointment_id]);
  }

  return {
    id: queueId,
    token_number: q.token_number,
    status: 'no_show',
    message: `Patient ${q.token_number} marked as no-show.`
  };
}

/**
 * Reassign Queued Patient to Another Doctor
 */
async function reassignDoctor(queueId, newDoctorId, actorUser = null) {
  const [docRows] = await db.query('SELECT id, department_id FROM doctors WHERE id = ?', [newDoctorId]);
  if (docRows.length === 0) throw new NotFoundError('Target doctor not found.');
  const doc = docRows[0];

  const [qRows] = await db.query('SELECT id, department_id, queue_date, token_number FROM opd_queues WHERE id = ?', [queueId]);
  if (qRows.length === 0) throw new NotFoundError('Queue record not found.');
  const q = qRows[0];

  if (q.department_id !== doc.department_id) {
    const { tokenNumber, tokenSequence } = await generateSafeOpdToken(doc.department_id, q.queue_date, db);
    await db.query(
      'UPDATE opd_queues SET doctor_id = ?, department_id = ?, token_number = ?, token_sequence = ? WHERE id = ?',
      [doc.id, doc.department_id, tokenNumber, tokenSequence, queueId]
    );
    return {
      id: queueId,
      new_doctor_id: doc.id,
      new_token: tokenNumber,
      message: `Patient transferred to new department with token ${tokenNumber}.`
    };
  } else {
    await db.query(
      'UPDATE opd_queues SET doctor_id = ? WHERE id = ?',
      [doc.id, queueId]
    );
    return {
      id: queueId,
      new_doctor_id: doc.id,
      message: 'Patient reassigned to new attending doctor.'
    };
  }
}

module.exports = {
  generateSafeOpdToken,
  getOpdDashboard,
  registerWalkInPatient,
  checkInAppointment,
  recordTriageVitals,
  callPatient,
  completeConsultation,
  markOpdNoShow,
  reassignDoctor
};
