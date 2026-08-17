const db = require('../config/db');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Determine Clinical Acuity & Priority Indicator from Vitals and Notes
 */
function calculatePriorityIndicator(vitals, latestNote) {
  if (latestNote && latestNote.priority_level === 'critical') return 'critical';

  if (vitals) {
    const spo2 = vitals.oxygen_saturation ? parseFloat(vitals.oxygen_saturation) : null;
    const hr = vitals.heart_rate || vitals.pulse ? parseInt(vitals.heart_rate || vitals.pulse, 10) : null;
    const temp = vitals.temperature ? parseFloat(vitals.temperature) : null;

    if ((spo2 && spo2 < 92) || (hr && (hr > 130 || hr < 45)) || (temp && (temp > 39.2 || temp < 35.5))) {
      return 'critical';
    }
    if ((spo2 && spo2 < 95) || (hr && (hr > 110 || hr < 55)) || (temp && temp > 38.3)) {
      return 'high_attention';
    }
  }

  if (latestNote && latestNote.priority_level === 'high_attention') return 'high_attention';
  if (latestNote && latestNote.priority_level === 'moderate') return 'moderate';

  return 'stable';
}

/**
 * Check Nurse Patient Access Authorization
 */
async function assertNurseAuthorized(patientId, nurseUser) {
  if (!nurseUser) return true;
  // Super admin and hospital admin always have full access
  if (['super_admin', 'hospital_admin', 'doctor'].includes(nurseUser.role)) return true;

  if (nurseUser.role === 'nurse') {
    // Check if patient is in a ward assigned to this nurse
    const [assignedWards] = await db.query(
      `SELECT nwa.ward_id 
       FROM nurse_ward_assignments nwa
       WHERE nwa.nurse_id = ? AND nwa.status = 'active'`,
      [nurseUser.id]
    );

    // If nurse has no specific ward assignment restrictions, allow general floor duty
    if (assignedWards.length === 0) return true;

    const wardIds = assignedWards.map(w => w.ward_id);

    // Check if patient is in one of these wards or assigned primary nurse
    const [adm] = await db.query(
      `SELECT id FROM ipd_admissions 
       WHERE patient_id = ? AND status IN ('admitted', 'under_treatment')
       AND (ward_id IN (?) OR primary_nurse_id = ?)`,
      [patientId, wardIds, nurseUser.id]
    );

    if (adm.length > 0) return true;

    // Check OPD visits or direct assignments
    const [opd] = await db.query(
      "SELECT id FROM opd_queues WHERE patient_id = ? AND status IN ('waiting', 'with_doctor')",
      [patientId]
    );
    if (opd.length > 0) return true;

    // If not in nurse's assigned inpatient wards or active OPD queue, check if any active admission exists
    const [anyAdm] = await db.query(
      "SELECT id, ward_id FROM ipd_admissions WHERE patient_id = ? AND status IN ('admitted', 'under_treatment')",
      [patientId]
    );
    if (anyAdm.length > 0 && !wardIds.includes(anyAdm[0].ward_id)) {
      throw new ForbiddenError('Access Denied: You are not authorized to view patients outside your assigned clinical wards.');
    }
  }

  return true;
}

/**
 * List Assigned Patients for Nursing Station with Priority Indicators
 */
async function getAssignedPatients(nurseUser, query = {}) {
  const { ward_id, priority, search } = query;
  const conditions = ["adm.status IN ('admitted', 'under_treatment')"];
  const params = [];

  // Filter by nurse assigned wards if user is a nurse
  if (nurseUser && nurseUser.role === 'nurse') {
    const [assignedWards] = await db.query(
      `SELECT ward_id FROM nurse_ward_assignments WHERE nurse_id = ? AND status = 'active'`,
      [nurseUser.id]
    );
    if (assignedWards.length > 0) {
      const wardIds = assignedWards.map(w => w.ward_id);
      conditions.push('(adm.ward_id IN (?) OR adm.primary_nurse_id = ?)');
      params.push(wardIds, nurseUser.id);
    }
  }

  if (ward_id && ward_id !== 'all') {
    conditions.push('adm.ward_id = ?');
    params.push(parseInt(ward_id, 10));
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR b.bed_number LIKE ?)');
    params.push(term, term, term, term);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [rows] = await db.query(
    `SELECT 
      p.id as patient_id,
      p.patient_code,
      p.first_name,
      p.last_name,
      p.gender,
      p.blood_group,
      p.date_of_birth,
      p.allergies,
      adm.id as admission_id,
      adm.admission_number,
      adm.admission_date,
      adm.admission_type,
      adm.admitting_diagnosis,
      adm.emergency_contact_name,
      adm.emergency_contact_phone,
      w.id as ward_id,
      w.name as ward_name,
      w.code as ward_code,
      r.room_number,
      b.id as bed_id,
      b.bed_number,
      b.bed_type,
      doc_u.full_name as attending_doctor_name,
      dept.name as department_name,
      (SELECT COUNT(*) FROM nursing_ward_tasks WHERE patient_id = p.id AND status = 'pending') as pending_tasks_count,
      (SELECT COUNT(*) FROM nursing_notes WHERE patient_id = p.id) as total_notes_count
    FROM ipd_admissions adm
    JOIN patients p ON adm.patient_id = p.id
    JOIN wards w ON adm.ward_id = w.id
    JOIN rooms r ON adm.room_id = r.id
    JOIN beds b ON adm.bed_id = b.id
    JOIN doctors doc ON adm.doctor_id = doc.id
    JOIN users doc_u ON doc.user_id = doc_u.id
    JOIN departments dept ON adm.department_id = dept.id
    ${whereClause}
    ORDER BY w.name ASC, b.bed_number ASC`,
    params
  );

  // Attach latest vitals, latest note, and compute priority indicator
  const enrichedPatients = await Promise.all(
    rows.map(async patient => {
      // Latest vitals
      const [vRows] = await db.query(
        `SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 1`,
        [patient.patient_id]
      );
      const latestVitals = vRows.length > 0 ? vRows[0] : null;

      // Latest nursing note
      const [nRows] = await db.query(
        `SELECT * FROM nursing_notes WHERE patient_id = ? ORDER BY created_at DESC LIMIT 1`,
        [patient.patient_id]
      );
      const latestNote = nRows.length > 0 ? nRows[0] : null;

      // Doctor instructions from daily rounds
      const [rRows] = await db.query(
        `SELECT treatment_plan, nursing_instructions, round_date, u.full_name as doctor_name
         FROM ipd_daily_rounds r
         JOIN doctors doc ON r.doctor_id = doc.id
         JOIN users u ON doc.user_id = u.id
         WHERE r.admission_id = ?
         ORDER BY r.round_date DESC LIMIT 1`,
        [patient.admission_id]
      );
      const doctorInstructions = rRows.length > 0 ? rRows[0] : null;

      const priorityIndicator = calculatePriorityIndicator(latestVitals, latestNote);

      return {
        ...patient,
        latest_vitals: latestVitals,
        latest_note: latestNote,
        doctor_instructions: doctorInstructions,
        priority_indicator: priorityIndicator
      };
    })
  );

  if (priority && priority !== 'all') {
    return enrichedPatients.filter(p => p.priority_indicator === priority);
  }

  return enrichedPatients;
}

/**
 * Get Comprehensive Patient Nursing Clinical Summary
 */
async function getPatientNursingSummary(patientId, nurseUser) {
  await assertNurseAuthorized(patientId, nurseUser);

  const [pRows] = await db.query('SELECT * FROM patients WHERE id = ?', [patientId]);
  if (pRows.length === 0) throw new NotFoundError('Patient not found.');
  const patient = pRows[0];

  // Active Admission
  const [admRows] = await db.query(
    `SELECT adm.*, w.name as ward_name, r.room_number, b.bed_number, doc_u.full_name as doctor_name
     FROM ipd_admissions adm
     JOIN wards w ON adm.ward_id = w.id
     JOIN rooms r ON adm.room_id = r.id
     JOIN beds b ON adm.bed_id = b.id
     JOIN doctors doc ON adm.doctor_id = doc.id
     JOIN users doc_u ON doc.user_id = doc_u.id
     WHERE adm.patient_id = ? AND adm.status IN ('admitted', 'under_treatment')
     ORDER BY adm.admission_date DESC LIMIT 1`,
    [patientId]
  );
  const activeAdmission = admRows.length > 0 ? admRows[0] : null;

  // Nursing Notes
  const [notes] = await db.query(
    `SELECT nn.*, u.full_name as nurse_name 
     FROM nursing_notes nn
     JOIN users u ON nn.nurse_id = u.id
     WHERE nn.patient_id = ?
     ORDER BY nn.created_at DESC`,
    [patientId]
  );

  // eMAR Medication Administrations
  const [emars] = await db.query(
    `SELECT mar.*, u.full_name as nurse_name 
     FROM nursing_medication_administrations mar
     JOIN users u ON mar.nurse_id = u.id
     WHERE mar.patient_id = ?
     ORDER BY mar.administered_time DESC`,
    [patientId]
  );

  // Vitals History
  const [vitals] = await db.query(
    `SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 20`,
    [patientId]
  );

  // Ward Tasks
  const [tasks] = await db.query(
    `SELECT t.*, u.full_name as assigned_nurse_name 
     FROM nursing_ward_tasks t
     LEFT JOIN users u ON t.assigned_nurse_id = u.id
     WHERE t.patient_id = ?
     ORDER BY t.due_time ASC`,
    [patientId]
  );

  // Doctor Round Orders
  let doctorOrders = [];
  if (activeAdmission) {
    const [rounds] = await db.query(
      `SELECT r.*, u.full_name as doctor_name 
       FROM ipd_daily_rounds r
       JOIN doctors doc ON r.doctor_id = doc.id
       JOIN users u ON doc.user_id = u.id
       WHERE r.admission_id = ?
       ORDER BY r.round_date DESC`,
      [activeAdmission.id]
    );
    doctorOrders = rounds;
  }

  const priorityIndicator = calculatePriorityIndicator(
    vitals.length > 0 ? vitals[0] : null,
    notes.length > 0 ? notes[0] : null
  );

  return {
    patient,
    active_admission: activeAdmission,
    priority_indicator: priorityIndicator,
    vitals,
    nursing_notes: notes,
    emar_records: emars,
    ward_tasks: tasks,
    doctor_orders: doctorOrders
  };
}

/**
 * Record Nursing Clinical Progress / Shift Note
 */
async function recordNursingNote(data, actorUser) {
  const patientId = parseInt(data.patient_id, 10);
  await assertNurseAuthorized(patientId, actorUser);

  const noteNumber = `NOT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const [res] = await db.query(
    `INSERT INTO nursing_notes 
     (note_number, patient_id, admission_id, nurse_id, note_type, priority_level, subjective_observation, objective_findings, nursing_interventions, patient_response, care_plan_instructions, intake_ml, output_ml)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      noteNumber,
      patientId,
      data.admission_id ? parseInt(data.admission_id, 10) : null,
      actorUser ? actorUser.id : 6,
      data.note_type,
      data.priority_level || 'stable',
      data.subjective_observation ? data.subjective_observation.trim() : null,
      data.objective_findings ? data.objective_findings.trim() : null,
      data.nursing_interventions.trim(),
      data.patient_response ? data.patient_response.trim() : null,
      data.care_plan_instructions ? data.care_plan_instructions.trim() : null,
      data.intake_ml ? parseInt(data.intake_ml, 10) : null,
      data.output_ml ? parseInt(data.output_ml, 10) : null
    ]
  );

  return {
    id: res.insertId,
    note_number: noteNumber,
    message: 'Nursing note recorded successfully.'
  };
}

/**
 * List Nursing Notes
 */
async function listNursingNotes(patientId, query = {}, actorUser) {
  await assertNurseAuthorized(patientId, actorUser);
  const { note_type, priority_level } = query;
  const conditions = ['nn.patient_id = ?'];
  const params = [parseInt(patientId, 10)];

  if (note_type && note_type !== 'all') {
    conditions.push('nn.note_type = ?');
    params.push(note_type);
  }

  if (priority_level && priority_level !== 'all') {
    conditions.push('nn.priority_level = ?');
    params.push(priority_level);
  }

  const [rows] = await db.query(
    `SELECT nn.*, u.full_name as nurse_name 
     FROM nursing_notes nn
     JOIN users u ON nn.nurse_id = u.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY nn.created_at DESC`,
    params
  );

  return rows;
}

/**
 * Record Medication Administration (eMAR)
 */
async function recordMedicationAdministration(data, actorUser) {
  const patientId = parseInt(data.patient_id, 10);
  await assertNurseAuthorized(patientId, actorUser);

  const adminNumber = `MAR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const scheduledTime = data.scheduled_time || new Date().toISOString().slice(0, 19).replace('T', ' ');
  const administeredTime = data.administered_time || new Date().toISOString().slice(0, 19).replace('T', ' ');

  const [res] = await db.query(
    `INSERT INTO nursing_medication_administrations 
     (administration_number, patient_id, admission_id, prescription_item_id, medicine_name, dosage, route, scheduled_time, administered_time, nurse_id, status, reason_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      adminNumber,
      patientId,
      data.admission_id ? parseInt(data.admission_id, 10) : null,
      data.prescription_item_id ? parseInt(data.prescription_item_id, 10) : null,
      data.medicine_name.trim(),
      data.dosage.trim(),
      data.route || 'oral',
      scheduledTime,
      administeredTime,
      actorUser ? actorUser.id : 6,
      data.status || 'administered',
      data.reason_notes ? data.reason_notes.trim() : null
    ]
  );

  return {
    id: res.insertId,
    administration_number: adminNumber,
    message: `eMAR: ${data.medicine_name} (${data.dosage}) marked as ${data.status || 'administered'}.`
  };
}

/**
 * Record Patient Vitals
 */
async function recordVitals(data, actorUser) {
  const patientId = parseInt(data.patient_id, 10);
  await assertNurseAuthorized(patientId, actorUser);

  let bmi = null;
  if (data.weight_kg && data.height_cm) {
    const hMeters = parseFloat(data.height_cm) / 100;
    if (hMeters > 0) {
      bmi = parseFloat((parseFloat(data.weight_kg) / (hMeters * hMeters)).toFixed(1));
    }
  }

  let systolic = data.systolic ? parseInt(data.systolic, 10) : null;
  let diastolic = data.diastolic ? parseInt(data.diastolic, 10) : null;
  if (data.blood_pressure && data.blood_pressure.includes('/')) {
    const parts = data.blood_pressure.split('/');
    systolic = parseInt(parts[0].trim(), 10) || null;
    diastolic = parseInt(parts[1].trim(), 10) || null;
  }

  const [res] = await db.query(
    `INSERT INTO vitals 
     (patient_id, nurse_id, recorded_by, systolic, diastolic, heart_rate, temperature, respiratory_rate, oxygen_saturation, blood_sugar, weight_kg, height_cm, bmi, notes, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      patientId,
      actorUser ? actorUser.id : 6,
      actorUser ? actorUser.id : 6,
      systolic,
      diastolic,
      data.heart_rate ? parseInt(data.heart_rate, 10) : (data.pulse ? parseInt(data.pulse, 10) : null),
      data.temperature ? parseFloat(data.temperature) : null,
      data.respiratory_rate ? parseInt(data.respiratory_rate, 10) : null,
      data.oxygen_saturation ? parseFloat(data.oxygen_saturation) : null,
      data.blood_sugar ? parseFloat(data.blood_sugar) : null,
      data.weight_kg ? parseFloat(data.weight_kg) : null,
      data.height_cm ? parseFloat(data.height_cm) : null,
      bmi,
      data.notes ? data.notes.trim() : null
    ]
  );

  return {
    id: res.insertId,
    patient_id: patientId,
    bmi,
    message: 'Patient vitals charted successfully.'
  };
}

/**
 * List Ward Tasks
 */
async function listWardTasks(query = {}, actorUser) {
  const { ward_id, status, priority, patient_id } = query;
  const conditions = [];
  const params = [];

  if (ward_id && ward_id !== 'all') {
    conditions.push('t.ward_id = ?');
    params.push(parseInt(ward_id, 10));
  }

  if (status && status !== 'all') {
    conditions.push('t.status = ?');
    params.push(status);
  }

  if (priority && priority !== 'all') {
    conditions.push('t.priority = ?');
    params.push(priority);
  }

  if (patient_id) {
    conditions.push('t.patient_id = ?');
    params.push(parseInt(patient_id, 10));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT 
      t.*,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      w.name as ward_name,
      w.code as ward_code,
      b.bed_number,
      u.full_name as assigned_nurse_name,
      cu.full_name as completed_by_name
    FROM nursing_ward_tasks t
    JOIN patients p ON t.patient_id = p.id
    JOIN wards w ON t.ward_id = w.id
    LEFT JOIN beds b ON t.bed_id = b.id
    LEFT JOIN users u ON t.assigned_nurse_id = u.id
    LEFT JOIN users cu ON t.completed_by = cu.id
    ${whereClause}
    ORDER BY 
      CASE t.priority 
        WHEN 'urgent_critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        ELSE 4 
      END ASC,
      t.due_time ASC`,
    params
  );

  return rows;
}

/**
 * Create Ward Task
 */
async function createWardTask(data, actorUser) {
  const taskNumber = `TSK-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const [res] = await db.query(
    `INSERT INTO nursing_ward_tasks 
     (task_number, patient_id, admission_id, ward_id, bed_id, task_type, description, priority, due_time, assigned_nurse_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      taskNumber,
      parseInt(data.patient_id, 10),
      data.admission_id ? parseInt(data.admission_id, 10) : null,
      parseInt(data.ward_id, 10),
      data.bed_id ? parseInt(data.bed_id, 10) : null,
      data.task_type,
      data.description.trim(),
      data.priority || 'medium',
      data.due_time,
      data.assigned_nurse_id ? parseInt(data.assigned_nurse_id, 10) : (actorUser ? actorUser.id : null)
    ]
  );

  return {
    id: res.insertId,
    task_number: taskNumber,
    message: 'Ward nursing task created successfully.'
  };
}

/**
 * Complete Ward Task
 */
async function completeWardTask(taskId, data, actorUser) {
  const [existing] = await db.query('SELECT * FROM nursing_ward_tasks WHERE id = ?', [taskId]);
  if (existing.length === 0) throw new NotFoundError('Ward task not found.');

  await db.query(
    `UPDATE nursing_ward_tasks 
     SET status = 'completed',
         completed_at = NOW(),
         completed_by = ?,
         completion_notes = ?
     WHERE id = ?`,
    [
      actorUser ? actorUser.id : 6,
      data.completion_notes ? data.completion_notes.trim() : 'Task completed as scheduled.',
      taskId
    ]
  );

  return { id: taskId, status: 'completed', message: 'Ward task marked as completed.' };
}

/**
 * Nursing Station KPIs & Statistics
 */
async function getNursingStats(nurseUser) {
  const [patientStats] = await db.query(`
    SELECT 
      COUNT(*) as total_inpatients,
      SUM(CASE WHEN adm.admission_type = 'emergency' THEN 1 ELSE 0 END) as emergency_admissions
    FROM ipd_admissions adm
    WHERE adm.status IN ('admitted', 'under_treatment')
  `);

  const [taskStats] = await db.query(`
    SELECT 
      COUNT(*) as total_tasks,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
      SUM(CASE WHEN status = 'pending' AND priority IN ('urgent_critical', 'high') THEN 1 ELSE 0 END) as urgent_tasks
    FROM nursing_ward_tasks
  `);

  const [emarStats] = await db.query(`
    SELECT 
      COUNT(*) as total_administrations_today,
      SUM(CASE WHEN status = 'administered' THEN 1 ELSE 0 END) as doses_given_today
    FROM nursing_medication_administrations
    WHERE DATE(administered_time) = CURDATE()
  `);

  return {
    total_assigned_inpatients: patientStats[0].total_inpatients || 0,
    emergency_admissions: patientStats[0].emergency_admissions || 0,
    pending_tasks: taskStats[0].pending_tasks || 0,
    urgent_tasks: taskStats[0].urgent_tasks || 0,
    doses_given_today: emarStats[0].doses_given_today || 0
  };
}

module.exports = {
  assertNurseAuthorized,
  getAssignedPatients,
  getPatientNursingSummary,
  recordNursingNote,
  listNursingNotes,
  recordMedicationAdministration,
  recordVitals,
  listWardTasks,
  createWardTask,
  completeWardTask,
  getNursingStats
};
