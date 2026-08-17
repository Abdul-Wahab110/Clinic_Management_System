const db = require('../config/db');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');

/**
 * List Emergency Visits with Multi-Criteria Filtering
 */
async function listEmergencyVisits(query = {}) {
  const { priority, status, is_trauma, search, page = 1, limit = 50 } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  if (priority && priority !== 'all') {
    conditions.push('ev.priority = ?');
    params.push(priority);
  }

  if (status && status !== 'all') {
    conditions.push('ev.status = ?');
    params.push(status);
  }

  if (is_trauma !== undefined) {
    conditions.push('ev.is_trauma = ?');
    params.push(is_trauma === 'true' || is_trauma === '1' ? 1 : 0);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(ev.emergency_number LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR b.bed_number LIKE ?)');
    params.push(term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total
     FROM emergency_visits ev
     JOIN patients p ON ev.patient_id = p.id
     LEFT JOIN beds b ON ev.bed_id = b.id
     ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await db.query(
    `SELECT 
      ev.*,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.gender as patient_gender,
      p.date_of_birth as patient_dob,
      p.blood_group,
      p.allergies,
      p.phone as patient_phone,
      w.name as ward_name,
      r.room_number,
      b.bed_number,
      doc_u.full_name as attending_doctor_name,
      nurse_u.full_name as triage_nurse_name,
      (SELECT COUNT(*) FROM emergency_clinical_notes WHERE emergency_visit_id = ev.id) as notes_count,
      (SELECT COUNT(*) FROM emergency_treatments WHERE emergency_visit_id = ev.id) as treatments_count
    FROM emergency_visits ev
    JOIN patients p ON ev.patient_id = p.id
    LEFT JOIN wards w ON ev.ward_id = w.id
    LEFT JOIN rooms r ON ev.room_id = r.id
    LEFT JOIN beds b ON ev.bed_id = b.id
    LEFT JOIN doctors doc ON ev.attending_doctor_id = doc.id
    LEFT JOIN users doc_u ON doc.user_id = doc_u.id
    LEFT JOIN users nurse_u ON ev.triage_nurse_id = nurse_u.id
    ${whereClause}
    ORDER BY 
      CASE ev.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END ASC,
      ev.arrival_time DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  // Attach latest vitals snapshot
  const enrichedVisits = await Promise.all(
    rows.map(async visit => {
      const [vRows] = await db.query(
        `SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 1`,
        [visit.patient_id]
      );
      return {
        ...visit,
        latest_vitals: vRows.length > 0 ? vRows[0] : null
      };
    })
  );

  return {
    visits: enrichedVisits,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Get Comprehensive Emergency Encounter Details
 */
async function getEmergencyVisitById(id) {
  const [rows] = await db.query(
    `SELECT 
      ev.*,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.gender as patient_gender,
      p.date_of_birth as patient_dob,
      p.blood_group,
      p.allergies,
      p.medical_history,
      p.phone as patient_phone,
      p.emergency_contact_name,
      p.emergency_contact_phone,
      w.name as ward_name,
      r.room_number,
      b.bed_number,
      doc_u.full_name as attending_doctor_name,
      nurse_u.full_name as triage_nurse_name,
      adm.admission_number as ipd_admission_number
    FROM emergency_visits ev
    JOIN patients p ON ev.patient_id = p.id
    LEFT JOIN wards w ON ev.ward_id = w.id
    LEFT JOIN rooms r ON ev.room_id = r.id
    LEFT JOIN beds b ON ev.bed_id = b.id
    LEFT JOIN doctors doc ON ev.attending_doctor_id = doc.id
    LEFT JOIN users doc_u ON doc.user_id = doc_u.id
    LEFT JOIN users nurse_u ON ev.triage_nurse_id = nurse_u.id
    LEFT JOIN ipd_admissions adm ON ev.ipd_admission_id = adm.id
    WHERE ev.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Emergency visit encounter not found.');
  const visit = rows[0];

  // Clinical trauma & triage notes
  const [notes] = await db.query(
    `SELECT ecn.*, doc_u.full_name as doctor_name, nurse_u.full_name as nurse_name
     FROM emergency_clinical_notes ecn
     LEFT JOIN doctors doc ON ecn.doctor_id = doc.id
     LEFT JOIN users doc_u ON doc.user_id = doc_u.id
     LEFT JOIN users nurse_u ON ecn.nurse_id = nurse_u.id
     WHERE ecn.emergency_visit_id = ?
     ORDER BY ecn.created_at ASC`,
    [id]
  );

  // Emergency treatments administered
  const [treatments] = await db.query(
    `SELECT et.*, u.full_name as administered_by_name
     FROM emergency_treatments et
     LEFT JOIN users u ON et.administered_by = u.id
     WHERE et.emergency_visit_id = ?
     ORDER BY et.administered_time ASC`,
    [id]
  );

  // Patient vitals history
  const [vitals] = await db.query(
    `SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 15`,
    [visit.patient_id]
  );

  return {
    ...visit,
    notes,
    treatments,
    vitals
  };
}

/**
 * Register Emergency Patient Encounter (Connects with Main Patient Record)
 */
async function registerEmergencyVisit(data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let patientId = data.patient_id ? parseInt(data.patient_id, 10) : null;

    // Connect with main patient record; create patient in patients table if walk-in / unknown trauma
    if (!patientId) {
      const patientCode = `PAT-${new Date().getFullYear()}-${Math.floor(1000000 + Math.random() * 9000000)}`;
      const firstName = data.first_name ? data.first_name.trim() : 'Unknown';
      const lastName = data.last_name ? data.last_name.trim() : `Trauma Patient (${new Date().toISOString().slice(11, 19)})`;

      const [pRes] = await connection.query(
        `INSERT INTO patients 
         (patient_code, first_name, last_name, gender, date_of_birth, blood_group, phone, allergies, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          patientCode,
          firstName,
          lastName,
          data.gender || 'other',
          data.date_of_birth || '1990-01-01',
          data.blood_group || 'Unknown',
          data.phone ? data.phone.trim() : null,
          data.allergies ? data.allergies.trim() : null
        ]
      );
      patientId = pRes.insertId;
    }

    // Generate unique ER Number
    const emergencyNumber = `ER-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const arrivalTime = data.arrival_time || new Date().toISOString().slice(0, 19).replace('T', ' ');

    let assignedBedId = data.bed_id ? parseInt(data.bed_id, 10) : null;
    let assignedRoomId = data.room_id ? parseInt(data.room_id, 10) : null;
    let assignedWardId = data.ward_id ? parseInt(data.ward_id, 10) : null;

    // If bed is specified, ensure it is available and lock it
    if (assignedBedId) {
      const [bedRows] = await connection.query('SELECT * FROM beds WHERE id = ? FOR UPDATE', [assignedBedId]);
      if (bedRows.length > 0) {
        assignedRoomId = bedRows[0].room_id;
        assignedWardId = bedRows[0].ward_id;
        await connection.query("UPDATE beds SET status = 'occupied' WHERE id = ?", [assignedBedId]);
      }
    }

    // Determine initial status based on triage
    const priority = data.priority || 'medium';
    let status = 'under_treatment';
    if (!data.attending_doctor_id && !data.triage_acuity_score) {
      status = 'triage_pending';
    }

    const [erRes] = await connection.query(
      `INSERT INTO emergency_visits 
       (emergency_number, patient_id, triage_nurse_id, attending_doctor_id, ward_id, room_id, bed_id, arrival_time, arrival_mode, is_trauma, chief_complaint, initial_triage_assessment, triage_acuity_score, priority, glasgow_coma_scale, pain_scale, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        emergencyNumber,
        patientId,
        data.triage_nurse_id ? parseInt(data.triage_nurse_id, 10) : (actorUser ? actorUser.id : 6),
        data.attending_doctor_id ? parseInt(data.attending_doctor_id, 10) : null,
        assignedWardId,
        assignedRoomId,
        assignedBedId,
        arrivalTime,
        data.arrival_mode || 'walk_in',
        data.is_trauma ? 1 : 0,
        data.chief_complaint.trim(),
        data.initial_triage_assessment ? data.initial_triage_assessment.trim() : null,
        data.triage_acuity_score || '3',
        priority,
        data.glasgow_coma_scale ? parseInt(data.glasgow_coma_scale, 10) : null,
        data.pain_scale ? parseInt(data.pain_scale, 10) : null,
        status
      ]
    );

    const erVisitId = erRes.insertId;

    // If emergency vitals charted at triage intake
    if (data.blood_pressure || data.heart_rate || data.temperature || data.oxygen_saturation) {
      let systolic = null;
      let diastolic = null;
      if (data.blood_pressure && data.blood_pressure.includes('/')) {
        const parts = data.blood_pressure.split('/');
        systolic = parseInt(parts[0].trim(), 10) || null;
        diastolic = parseInt(parts[1].trim(), 10) || null;
      }

      await connection.query(
        `INSERT INTO vitals 
         (patient_id, nurse_id, recorded_by, systolic, diastolic, heart_rate, temperature, respiratory_rate, oxygen_saturation, notes, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          patientId,
          actorUser ? actorUser.id : 6,
          actorUser ? actorUser.id : 6,
          systolic,
          diastolic,
          data.heart_rate ? parseInt(data.heart_rate, 10) : null,
          data.temperature ? parseFloat(data.temperature) : null,
          data.respiratory_rate ? parseInt(data.respiratory_rate, 10) : null,
          data.oxygen_saturation ? parseFloat(data.oxygen_saturation) : null,
          'Emergency Triage Initial Vitals'
        ]
      );
    }

    await connection.commit();

    return {
      id: erVisitId,
      emergency_number: emergencyNumber,
      patient_id: patientId,
      priority,
      status,
      message: `Emergency encounter ${emergencyNumber} registered successfully (${priority.toUpperCase()} Priority).`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update Emergency Triage Assessment
 */
async function updateTriage(id, data, actorUser) {
  const [existing] = await db.query('SELECT * FROM emergency_visits WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Emergency visit not found.');
  const cur = existing[0];

  const priority = data.priority || cur.priority;
  const acuity = data.triage_acuity_score || cur.triage_acuity_score;

  await db.query(
    `UPDATE emergency_visits 
     SET triage_acuity_score = ?,
         priority = ?,
         glasgow_coma_scale = ?,
         pain_scale = ?,
         initial_triage_assessment = ?,
         triage_nurse_id = ?,
         status = CASE WHEN status = 'triage_pending' THEN 'under_treatment' ELSE status END
     WHERE id = ?`,
    [
      acuity,
      priority,
      data.glasgow_coma_scale !== undefined ? parseInt(data.glasgow_coma_scale, 10) : cur.glasgow_coma_scale,
      data.pain_scale !== undefined ? parseInt(data.pain_scale, 10) : cur.pain_scale,
      data.initial_triage_assessment !== undefined ? data.initial_triage_assessment.trim() : cur.initial_triage_assessment,
      actorUser ? actorUser.id : cur.triage_nurse_id,
      id
    ]
  );

  return { id, priority, acuity, message: `Emergency triage updated to Priority: ${priority.toUpperCase()}.` };
}

/**
 * Record Emergency Clinical Note (Primary / Secondary Survey, Physician Orders)
 */
async function recordEmergencyClinicalNote(data, actorUser) {
  const visitId = parseInt(data.emergency_visit_id, 10);
  const [vRows] = await db.query('SELECT patient_id FROM emergency_visits WHERE id = ?', [visitId]);
  if (vRows.length === 0) throw new NotFoundError('Emergency visit not found.');

  const patientId = vRows[0].patient_id;
  const noteNumber = `ERN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const [res] = await db.query(
    `INSERT INTO emergency_clinical_notes 
     (note_number, emergency_visit_id, patient_id, doctor_id, nurse_id, note_type, primary_survey_airway, primary_survey_breathing, primary_survey_circulation, primary_survey_disability, primary_survey_exposure, clinical_findings, treatment_orders)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      noteNumber,
      visitId,
      patientId,
      data.doctor_id ? parseInt(data.doctor_id, 10) : (actorUser && actorUser.role === 'doctor' ? actorUser.id : null),
      data.nurse_id ? parseInt(data.nurse_id, 10) : (actorUser && actorUser.role === 'nurse' ? actorUser.id : null),
      data.note_type,
      data.primary_survey_airway ? data.primary_survey_airway.trim() : null,
      data.primary_survey_breathing ? data.primary_survey_breathing.trim() : null,
      data.primary_survey_circulation ? data.primary_survey_circulation.trim() : null,
      data.primary_survey_disability ? data.primary_survey_disability.trim() : null,
      data.primary_survey_exposure ? data.primary_survey_exposure.trim() : null,
      data.clinical_findings.trim(),
      data.treatment_orders ? data.treatment_orders.trim() : null
    ]
  );

  return { id: res.insertId, note_number: noteNumber, message: 'Emergency clinical note saved successfully.' };
}

/**
 * Record Emergency Treatment
 */
async function recordEmergencyTreatment(data, actorUser) {
  const visitId = parseInt(data.emergency_visit_id, 10);
  const [vRows] = await db.query('SELECT patient_id FROM emergency_visits WHERE id = ?', [visitId]);
  if (vRows.length === 0) throw new NotFoundError('Emergency visit not found.');

  const patientId = vRows[0].patient_id;
  const treatmentNumber = `ERT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const [res] = await db.query(
    `INSERT INTO emergency_treatments 
     (treatment_number, emergency_visit_id, patient_id, treatment_type, description, dosage_spec, administered_by, administered_time, patient_response)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [
      treatmentNumber,
      visitId,
      patientId,
      data.treatment_type,
      data.description.trim(),
      data.dosage_spec ? data.dosage_spec.trim() : null,
      actorUser ? actorUser.id : 6,
      data.patient_response ? data.patient_response.trim() : null
    ]
  );

  return { id: res.insertId, treatment_number: treatmentNumber, message: 'Emergency treatment documented.' };
}

/**
 * One-Click Emergency -> Inpatient Department (IPD) Admission
 */
async function admitToIpd(id, data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [vRows] = await connection.query('SELECT * FROM emergency_visits WHERE id = ? FOR UPDATE', [id]);
    if (vRows.length === 0) throw new NotFoundError('Emergency visit encounter not found.');
    const ev = vRows[0];

    if (ev.status === 'admitted_ipd') {
      throw new BadRequestError('Patient has already been admitted to IPD.');
    }

    const targetWardId = parseInt(data.ward_id, 10);
    const targetBedId = parseInt(data.bed_id, 10);

    // Verify Target Bed is Available & Lock
    const [bedRows] = await connection.query('SELECT * FROM beds WHERE id = ? FOR UPDATE', [targetBedId]);
    if (bedRows.length === 0) throw new NotFoundError('Target bed not found.');
    if (bedRows[0].status !== 'available') {
      throw new ConflictError(`Target bed '${bedRows[0].bed_number}' is currently occupied or unavailable.`);
    }

    const targetRoomId = bedRows[0].room_id;
    const admissionNumber = `IPD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // Create IPD Admission
    const [admRes] = await connection.query(
      `INSERT INTO ipd_admissions 
       (admission_number, patient_id, doctor_id, department_id, ward_id, room_id, bed_id, admission_date, admission_type, admitting_diagnosis, chief_complaint, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'emergency', ?, ?, 'admitted')`,
      [
        admissionNumber,
        ev.patient_id,
        ev.attending_doctor_id || 1,
        1, // General/Cardiology
        targetWardId,
        targetRoomId,
        targetBedId,
        data.admitting_diagnosis ? data.admitting_diagnosis.trim() : ev.chief_complaint,
        ev.chief_complaint
      ]
    );

    const admissionId = admRes.insertId;

    // Update target IPD bed to occupied
    await connection.query(
      "UPDATE beds SET status = 'occupied', current_admission_id = ? WHERE id = ?",
      [admissionId, targetBedId]
    );

    // Release ER Bed if assigned
    if (ev.bed_id) {
      await connection.query("UPDATE beds SET status = 'available' WHERE id = ?", [ev.bed_id]);
    }

    // Update emergency visit status
    await connection.query(
      `UPDATE emergency_visits 
       SET status = 'admitted_ipd',
           discharge_disposition = 'ipd_admission',
           discharge_admission_date = NOW(),
           ipd_admission_id = ?
       WHERE id = ?`,
      [admissionId, id]
    );

    await connection.commit();

    return {
      admission_id: admissionId,
      admission_number: admissionNumber,
      message: `Emergency patient successfully admitted to IPD (${admissionNumber}).`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Emergency Transfer (ICU / Surgery / External Facility)
 */
async function transferPatient(id, data, actorUser) {
  const [existing] = await db.query('SELECT * FROM emergency_visits WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Emergency visit not found.');
  const ev = existing[0];

  // Release ER bed
  if (ev.bed_id) {
    await db.query("UPDATE beds SET status = 'available' WHERE id = ?", [ev.bed_id]);
  }

  await db.query(
    `UPDATE emergency_visits 
     SET status = 'transferred',
         discharge_disposition = ?,
         discharge_admission_date = NOW(),
         transfer_facility_name = ?,
         discharge_summary = ?
     WHERE id = ?`,
    [
      data.disposition || 'external_transfer',
      data.transfer_facility_name ? data.transfer_facility_name.trim() : 'Tertiary Specialty Center',
      data.transfer_reason ? data.transfer_reason.trim() : 'Transferred for urgent intervention',
      id
    ]
  );

  return { id, status: 'transferred', message: 'Patient emergency transfer documented.' };
}

/**
 * Emergency Discharge
 */
async function dischargePatient(id, data, actorUser) {
  const [existing] = await db.query('SELECT * FROM emergency_visits WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Emergency visit not found.');
  const ev = existing[0];

  // Release ER bed
  if (ev.bed_id) {
    await db.query("UPDATE beds SET status = 'available' WHERE id = ?", [ev.bed_id]);
  }

  await db.query(
    `UPDATE emergency_visits 
     SET status = 'discharged',
         discharge_disposition = 'home',
         discharge_admission_date = NOW(),
         discharge_summary = ?
     WHERE id = ?`,
    [
      data.discharge_summary ? data.discharge_summary.trim() : 'Patient stabilized and discharged home with outpatient follow-up plan.',
      id
    ]
  );

  return { id, status: 'discharged', message: 'Emergency patient stabilized and discharged.' };
}

/**
 * Emergency Department KPIs & Statistics
 */
async function getEmergencyStats() {
  const [erStats] = await db.query(`
    SELECT 
      COUNT(*) as total_active_er,
      SUM(CASE WHEN priority = 'critical' AND status IN ('triage_pending', 'under_treatment', 'observation') THEN 1 ELSE 0 END) as critical_patients_count,
      SUM(CASE WHEN priority = 'high' AND status IN ('triage_pending', 'under_treatment', 'observation') THEN 1 ELSE 0 END) as high_priority_count,
      SUM(CASE WHEN is_trauma = 1 AND status IN ('triage_pending', 'under_treatment', 'observation') THEN 1 ELSE 0 END) as active_trauma_count,
      SUM(CASE WHEN status = 'admitted_ipd' AND DATE(discharge_admission_date) = CURDATE() THEN 1 ELSE 0 END) as admitted_to_ipd_today
    FROM emergency_visits
  `);

  const [bedStats] = await db.query(`
    SELECT 
      COUNT(*) as total_er_beds,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_er_beds,
      SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_er_beds
    FROM beds
    WHERE bed_number LIKE 'BED-ER%' OR ward_id IN (SELECT id FROM wards WHERE code = 'EM-TRAUMA')
  `);

  return {
    ...erStats[0],
    ...bedStats[0]
  };
}

module.exports = {
  listEmergencyVisits,
  getEmergencyVisitById,
  registerEmergencyVisit,
  updateTriage,
  recordEmergencyClinicalNote,
  recordEmergencyTreatment,
  admitToIpd,
  transferPatient,
  dischargePatient,
  getEmergencyStats
};
