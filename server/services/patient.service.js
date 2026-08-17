const db = require('../config/db');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} = require('../utils/errors');

/**
 * Generate a guaranteed unique Patient Code: PAT-YEAR-XXXXX
 */
async function generateUniquePatientCode(conn = db) {
  const currentYear = new Date().getFullYear();
  const [rows] = await conn.query('SELECT COUNT(*) as count FROM patients');
  const count = rows[0].count + 1;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  let code = `PAT-${currentYear}-${String(count).padStart(3, '0')}${randomSuffix}`;

  // Double-check uniqueness
  let [exists] = await conn.query('SELECT id FROM patients WHERE patient_code = ? LIMIT 1', [code]);
  while (exists.length > 0) {
    const freshRandom = Math.floor(10000 + Math.random() * 90000);
    code = `PAT-${currentYear}-${freshRandom}`;
    [exists] = await conn.query('SELECT id FROM patients WHERE patient_code = ? LIMIT 1', [code]);
  }
  return code;
}

/**
 * Check and enforce patient data isolation
 * If requesting user is a patient, they can ONLY access their own records.
 */
async function enforcePatientAccess(patientId, requestingUser) {
  if (!requestingUser) {
    throw new ForbiddenError('Authentication required to access patient data.');
  }

  // Super Admin, Hospital Admin, Doctor, Receptionist, Nurse, Accountant, Lab Tech have staff access
  if (requestingUser.role !== 'patient') {
    return true;
  }

  // If requesting user is a patient, verify they own this record
  const [patients] = await db.query('SELECT id, user_id FROM patients WHERE id = ? LIMIT 1', [patientId]);
  if (patients.length === 0) {
    throw new NotFoundError('Patient record not found.');
  }

  if (patients[0].user_id !== requestingUser.id) {
    throw new ForbiddenError('Access denied: You are not authorized to view or access records belonging to another patient.');
  }

  return true;
}

/**
 * List Patients with Search, Multi-criteria Filters, Sorting & Pagination
 */
async function listPatients(params = {}) {
  const {
    search,
    status,
    gender,
    blood_group,
    startDate,
    endDate,
    sortBy = 'created_at',
    sortOrder = 'DESC',
    page = 1,
    limit = 10
  } = params;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (pageNum - 1) * limitNum;

  const allowedSortCols = {
    'id': 'p.id',
    'created_at': 'p.created_at',
    'registration_date': 'p.registration_date',
    'patient_code': 'p.patient_code',
    'first_name': 'p.first_name',
    'last_name': 'p.last_name',
    'date_of_birth': 'p.date_of_birth',
    'status': 'p.status',
    'blood_group': 'p.blood_group'
  };

  const sortColumn = allowedSortCols[sortBy] || 'p.created_at';
  const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const whereClauses = [];
  const queryParams = [];

  // Search by name, code, phone, email, identification (CNIC)
  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    whereClauses.push(`(
      p.first_name LIKE ? OR 
      p.last_name LIKE ? OR 
      CONCAT(p.first_name, ' ', p.last_name) LIKE ? OR
      p.patient_code LIKE ? OR 
      p.phone LIKE ? OR 
      p.email LIKE ? OR 
      p.identification_number LIKE ?
    )`);
    queryParams.push(term, term, term, term, term, term, term);
  }

  // Filter: Status
  if (status && status !== 'all') {
    whereClauses.push('p.status = ?');
    queryParams.push(status);
  }

  // Filter: Gender
  if (gender && gender !== 'all') {
    whereClauses.push('p.gender = ?');
    queryParams.push(gender);
  }

  // Filter: Blood Group
  if (blood_group && blood_group !== 'all') {
    whereClauses.push('p.blood_group = ?');
    queryParams.push(blood_group);
  }

  // Filter: Date Range
  if (startDate) {
    whereClauses.push('(p.registration_date >= ? OR p.created_at >= ?)');
    queryParams.push(startDate, startDate);
  }
  if (endDate) {
    whereClauses.push('(p.registration_date <= ? OR p.created_at <= ?)');
    queryParams.push(endDate, endDate);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get Total Count
  const [countRows] = await db.query(
    `SELECT COUNT(*) as total FROM patients p ${whereSql}`,
    queryParams
  );
  const total = countRows[0].total;

  // Fetch Paginated Patients with Calculated Age and Counts
  const [patients] = await db.query(
    `SELECT 
        p.id,
        p.user_id,
        p.patient_code,
        p.first_name,
        p.last_name,
        CONCAT(p.first_name, ' ', p.last_name) as full_name,
        p.gender,
        p.date_of_birth,
        TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age,
        p.blood_group,
        p.phone,
        p.email,
        p.address,
        p.identification_number,
        p.emergency_contact_name,
        p.emergency_contact_phone,
        p.emergency_contact_relation,
        p.allergies,
        p.medical_history,
        p.registration_date,
        p.status,
        p.profile_image,
        p.marital_status,
        p.occupation,
        p.insurance_provider,
        p.insurance_policy_number,
        p.created_at,
        p.updated_at,
        (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.id) AS total_appointments,
        (SELECT COUNT(*) FROM medical_records m WHERE m.patient_id = p.id) AS total_records,
        (SELECT COUNT(*) FROM invoices i WHERE i.patient_id = p.id) AS total_invoices
     FROM patients p
     ${whereSql}
     ORDER BY ${sortColumn} ${orderDirection}
     LIMIT ? OFFSET ?`,
    [...queryParams, limitNum, offset]
  );

  // Overall Statistics for Dashboard / Header Cards
  const [statRows] = await db.query(`
    SELECT 
      COUNT(*) as total_patients,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_patients,
      SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_patients,
      SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_patients,
      SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new_this_month
    FROM patients
  `);

  const stats = statRows[0] || {
    total_patients: total,
    active_patients: 0,
    inactive_patients: 0,
    suspended_patients: 0,
    new_this_month: 0
  };

  return {
    patients,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
    stats
  };
}

/**
 * Get Comprehensive Patient Profile by ID
 */
async function getPatientById(patientId, requestingUser) {
  await enforcePatientAccess(patientId, requestingUser);

  const [patients] = await db.query(
    `SELECT 
        p.id,
        p.user_id,
        p.patient_code,
        p.first_name,
        p.last_name,
        CONCAT(p.first_name, ' ', p.last_name) as full_name,
        p.gender,
        p.date_of_birth,
        TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age,
        p.blood_group,
        p.phone,
        p.email,
        p.address,
        p.identification_number,
        p.emergency_contact_name,
        p.emergency_contact_phone,
        p.emergency_contact_relation,
        p.allergies,
        p.medical_history,
        p.registration_date,
        p.status,
        p.profile_image,
        p.marital_status,
        p.occupation,
        p.insurance_provider,
        p.insurance_policy_number,
        p.created_at,
        p.updated_at,
        u.email as portal_account_email,
        u.status as portal_account_status
     FROM patients p
     LEFT JOIN users u ON p.user_id = u.id
     WHERE p.id = ? LIMIT 1`,
    [patientId]
  );

  if (patients.length === 0) {
    throw new NotFoundError('Patient profile not found.');
  }

  const patient = patients[0];

  // Latest Vitals
  const [latestVitals] = await db.query(
    `SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 1`,
    [patientId]
  );

  // Summary Metrics
  const [metrics] = await db.query(
    `SELECT 
        (SELECT COUNT(*) FROM appointments WHERE patient_id = ?) as total_appointments,
        (SELECT COUNT(*) FROM appointments WHERE patient_id = ? AND status = 'completed') as completed_visits,
        (SELECT COUNT(*) FROM medical_records WHERE patient_id = ?) as total_medical_records,
        (SELECT COUNT(*) FROM prescriptions WHERE patient_id = ?) as total_prescriptions,
        (SELECT COUNT(*) FROM lab_orders WHERE patient_id = ?) as total_lab_orders,
        (SELECT COUNT(*) FROM patient_documents WHERE patient_id = ?) as total_documents,
        (SELECT COALESCE(SUM(net_amount), 0) FROM invoices WHERE patient_id = ?) as total_billed,
        (SELECT COALESCE(SUM(net_amount), 0) FROM invoices WHERE patient_id = ? AND status IN ('unpaid', 'partially_paid')) as outstanding_balance
    `,
    [patientId, patientId, patientId, patientId, patientId, patientId, patientId, patientId]
  );

  return {
    ...patient,
    latestVitals: latestVitals[0] || null,
    metrics: metrics[0] || {}
  };
}

/**
 * Get Patient Appointments
 */
async function getPatientAppointments(patientId, requestingUser) {
  await enforcePatientAccess(patientId, requestingUser);

  const [appointments] = await db.query(
    `SELECT 
        a.id,
        a.appointment_number,
        a.appointment_date,
        a.appointment_time,
        a.type,
        a.status,
        a.reason,
        a.notes,
        a.created_at,
        d.id as doctor_id,
        u.full_name as doctor_name,
        d.specialization as doctor_specialization,
        d.room_number as doctor_room,
        dept.id as department_id,
        dept.name as department_name,
        dept.icon as department_icon
     FROM appointments a
     LEFT JOIN doctors d ON a.doctor_id = d.id
     LEFT JOIN users u ON d.user_id = u.id
     LEFT JOIN departments dept ON a.department_id = dept.id
     WHERE a.patient_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    [patientId]
  );

  return appointments;
}

/**
 * Get Patient Visits (Completed encounters, consultations & triage)
 */
async function getPatientVisits(patientId, requestingUser) {
  await enforcePatientAccess(patientId, requestingUser);

  const [visits] = await db.query(
    `SELECT 
        a.id as appointment_id,
        a.appointment_number,
        a.appointment_date as visit_date,
        a.appointment_time as visit_time,
        a.type as visit_type,
        a.status,
        a.reason as chief_complaint,
        a.notes,
        u.full_name as doctor_name,
        d.specialization,
        dept.name as department_name,
        mr.id as medical_record_id,
        mr.diagnosis,
        mr.clinical_notes
     FROM appointments a
     LEFT JOIN doctors d ON a.doctor_id = d.id
     LEFT JOIN users u ON d.user_id = u.id
     LEFT JOIN departments dept ON a.department_id = dept.id
     LEFT JOIN medical_records mr ON mr.appointment_id = a.id
     WHERE a.patient_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    [patientId]
  );

  return visits;
}

/**
 * Get Patient Medical Records (EMR)
 */
async function getPatientMedicalRecords(patientId, requestingUser) {
  await enforcePatientAccess(patientId, requestingUser);

  const [records] = await db.query(
    `SELECT 
        m.id,
        m.appointment_id,
        m.record_date,
        m.chief_complaint,
        m.diagnosis,
        m.vitals_json,
        m.clinical_notes,
        m.follow_up_date,
        m.created_at,
        d.id as doctor_id,
        u.full_name as doctor_name,
        d.specialization as doctor_specialization,
        dept.name as department_name
     FROM medical_records m
     LEFT JOIN doctors d ON m.doctor_id = d.id
     LEFT JOIN users u ON d.user_id = u.id
     LEFT JOIN departments dept ON d.department_id = dept.id
     WHERE m.patient_id = ?
     ORDER BY m.record_date DESC, m.id DESC`,
    [patientId]
  );

  // Attach prescriptions linked to each medical record
  for (const record of records) {
    const [prescriptions] = await db.query(
      `SELECT id, medicine_name, dosage, frequency, duration, instructions
       FROM prescriptions
       WHERE record_id = ?`,
      [record.id]
    );
    record.prescriptions = prescriptions;
  }

  return records;
}

/**
 * Get Patient Prescriptions
 */
async function getPatientPrescriptions(patientId, requestingUser) {
  await enforcePatientAccess(patientId, requestingUser);

  const [prescriptions] = await db.query(
    `SELECT 
        pr.id,
        pr.record_id,
        pr.medicine_name,
        pr.dosage,
        pr.frequency,
        pr.duration,
        pr.instructions,
        pr.created_at,
        u.full_name as doctor_name,
        doc.specialization as doctor_specialization,
        mr.record_date,
        mr.diagnosis
     FROM prescriptions pr
     LEFT JOIN doctors doc ON pr.doctor_id = doc.id
     LEFT JOIN users u ON doc.user_id = u.id
     LEFT JOIN medical_records mr ON pr.record_id = mr.id
     WHERE pr.patient_id = ?
     ORDER BY pr.created_at DESC`,
    [patientId]
  );

  return prescriptions;
}

/**
 * Get Patient Lab Reports & Orders
 */
async function getPatientLabReports(patientId, requestingUser) {
  await enforcePatientAccess(patientId, requestingUser);

  const [reports] = await db.query(
    `SELECT 
        lo.id,
        lo.order_number,
        lo.order_date,
        lo.sample_type,
        lo.sample_collected_at,
        lo.result_value,
        lo.result_notes,
        lo.status,
        lo.completed_at,
        lo.created_at,
        lt.id as test_id,
        lt.name as test_name,
        lt.code as test_code,
        lt.category as test_category,
        lt.normal_range,
        lt.unit,
        lt.price,
        u.full_name as ordering_doctor
     FROM lab_orders lo
     JOIN lab_tests lt ON lo.test_id = lt.id
     LEFT JOIN doctors d ON lo.doctor_id = d.id
     LEFT JOIN users u ON d.user_id = u.id
     WHERE lo.patient_id = ?
     ORDER BY lo.order_date DESC, lo.id DESC`,
    [patientId]
  );

  return reports;
}

/**
 * Get Patient Invoices
 */
async function getPatientInvoices(patientId, requestingUser) {
  await enforcePatientAccess(patientId, requestingUser);

  const [invoices] = await db.query(
    `SELECT 
        i.id,
        i.invoice_number,
        i.appointment_id,
        i.total_amount,
        i.discount_amount,
        i.tax_amount,
        i.net_amount,
        i.status,
        i.due_date,
        i.created_at,
        (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.invoice_id = i.id) as total_paid,
        (i.net_amount - (SELECT COALESCE(SUM(p.amount_paid), 0) FROM payments p WHERE p.invoice_id = i.id)) as balance_due
     FROM invoices i
     WHERE i.patient_id = ?
     ORDER BY i.created_at DESC`,
    [patientId]
  );

  return invoices;
}

/**
 * Get Patient Payments
 */
async function getPatientPayments(patientId, requestingUser) {
  await enforcePatientAccess(patientId, requestingUser);

  const [payments] = await db.query(
    `SELECT 
        p.id,
        p.invoice_id,
        p.amount_paid,
        p.payment_method,
        p.transaction_ref,
        p.payment_date,
        p.notes,
        i.invoice_number,
        i.net_amount as invoice_total
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     WHERE i.patient_id = ?
     ORDER BY p.payment_date DESC`,
    [patientId]
  );

  return payments;
}

/**
 * Get Patient Documents
 */
async function getPatientDocuments(patientId, requestingUser) {
  await enforcePatientAccess(patientId, requestingUser);

  const [documents] = await db.query(
    `SELECT 
        pd.id,
        pd.document_name,
        pd.document_type,
        pd.file_path,
        pd.file_size_kb,
        pd.notes,
        pd.uploaded_at,
        u.full_name as uploaded_by_name,
        r.display_name as uploaded_by_role
     FROM patient_documents pd
     LEFT JOIN users u ON pd.uploaded_by = u.id
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE pd.patient_id = ?
     ORDER BY pd.uploaded_at DESC`,
    [patientId]
  );

  return documents;
}

/**
 * Get Patient Vitals Timeline
 */
async function getPatientVitals(patientId, requestingUser) {
  await enforcePatientAccess(patientId, requestingUser);

  const [vitals] = await db.query(
    `SELECT 
        v.id,
        v.systolic,
        v.diastolic,
        v.heart_rate,
        v.temperature,
        v.respiratory_rate,
        v.oxygen_saturation,
        v.blood_sugar,
        v.weight_kg,
        v.height_cm,
        v.bmi,
        v.notes,
        v.recorded_at,
        u.full_name as recorded_by_name
     FROM vitals v
     LEFT JOIN users u ON v.recorded_by = u.id
     WHERE v.patient_id = ?
     ORDER BY v.recorded_at DESC`,
    [patientId]
  );

  return vitals;
}

/**
 * Register / Create New Patient Profile
 */
async function createPatient(data, actorUser, ip = null, userAgent = null) {
  return await db.withTransaction(async (conn) => {
    // 1. Check for duplicate phone or identification number
    if (data.identification_number && data.identification_number.trim().length > 0) {
      const [existingCnic] = await conn.query(
        'SELECT id, patient_code FROM patients WHERE identification_number = ? LIMIT 1',
        [data.identification_number.trim()]
      );
      if (existingCnic.length > 0) {
        throw new ConflictError(`A patient record with Identification/CNIC '${data.identification_number}' already exists (${existingCnic[0].patient_code}).`);
      }
    }

    // 2. Generate Unique Patient Code
    const patientCode = data.patient_code && data.patient_code.trim().length > 0
      ? data.patient_code.trim()
      : await generateUniquePatientCode(conn);

    // Double check patient code uniqueness
    const [existingCode] = await conn.query('SELECT id FROM patients WHERE patient_code = ? LIMIT 1', [patientCode]);
    if (existingCode.length > 0) {
      throw new ConflictError(`Patient Code '${patientCode}' is already registered. Patient ID must be unique.`);
    }

    let linkedUserId = null;

    // 3. Optional: Create linked User account for portal access
    if (data.create_portal_account && data.email && data.password) {
      const [existingUser] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [data.email.trim()]);
      if (existingUser.length > 0) {
        throw new ConflictError('A user account with this email address already exists.');
      }

      const [roles] = await conn.query("SELECT id FROM roles WHERE name = 'patient' LIMIT 1");
      const patientRoleId = roles[0]?.id || 9;

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(data.password, salt);

      const [userRes] = await conn.query(
        `INSERT INTO users (role_id, full_name, email, password_hash, phone, status, email_verified)
         VALUES (?, ?, ?, ?, ?, 'active', 1)`,
        [
          patientRoleId,
          `${data.first_name.trim()} ${data.last_name.trim()}`,
          data.email.trim().toLowerCase(),
          passwordHash,
          data.phone ? data.phone.trim() : null
        ]
      );
      linkedUserId = userRes.insertId;
    }

    // Name Normalization (handles full_name or first_name + last_name)
    let firstName = data.first_name ? data.first_name.trim() : '';
    let lastName = data.last_name ? data.last_name.trim() : '';
    if ((!firstName || !lastName) && data.full_name) {
      const parts = data.full_name.trim().split(/\s+/);
      firstName = firstName || parts[0] || 'Patient';
      lastName = lastName || parts.slice(1).join(' ') || parts[0] || 'User';
    }
    firstName = firstName || 'Patient';
    lastName = lastName || 'User';

    // Normalize Gender
    const rawGender = (data.gender || 'other').toLowerCase().trim();
    const normalizedGender = ['male', 'female', 'other'].includes(rawGender) ? rawGender : 'other';

    // Normalize Date of Birth
    let normalizedDob = '2000-01-01';
    if (data.date_of_birth) {
      const dobStr = String(data.date_of_birth).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) {
        normalizedDob = dobStr;
      } else if (/^\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}$/.test(dobStr)) {
        const parts = dobStr.split(/[\/\-\.]/);
        normalizedDob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    // Normalize Blood Group
    const validBgs = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const matchedBg = data.blood_group ? validBgs.find(b => b.toLowerCase() === data.blood_group.trim().toLowerCase()) : null;
    const normalizedBloodGroup = matchedBg || 'Unknown';

    // 4. Insert Patient Record
    const [patientResult] = await conn.query(
      `INSERT INTO patients (
        user_id, patient_code, first_name, last_name, gender, date_of_birth, blood_group,
        phone, email, address, identification_number, emergency_contact_name, emergency_contact_phone,
        emergency_contact_relation, allergies, medical_history, registration_date, status, profile_image,
        marital_status, occupation, insurance_provider, insurance_policy_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        linkedUserId,
        patientCode,
        firstName,
        lastName,
        normalizedGender,
        normalizedDob,
        normalizedBloodGroup,
        data.phone ? data.phone.trim() : '',
        data.email ? data.email.trim().toLowerCase() : null,
        data.address ? data.address.trim() : null,
        data.identification_number ? data.identification_number.trim() : null,
        data.emergency_contact_name ? data.emergency_contact_name.trim() : null,
        data.emergency_contact_phone ? data.emergency_contact_phone.trim() : null,
        data.emergency_contact_relation ? data.emergency_contact_relation.trim() : null,
        data.allergies ? data.allergies.trim() : null,
        data.medical_history ? data.medical_history.trim() : null,
        data.registration_date || new Date().toISOString().split('T')[0],
        data.status || 'active',
        data.profile_image || null,
        data.marital_status || 'single',
        data.occupation ? data.occupation.trim() : null,
        data.insurance_provider ? data.insurance_provider.trim() : null,
        data.insurance_policy_number ? data.insurance_policy_number.trim() : null
      ]
    );

    const newPatientId = patientResult.insertId;

    // 5. Audit Log
    await logger.audit(
      actorUser?.id || null,
      'PATIENT_REGISTERED',
      'patients',
      newPatientId,
      ip,
      userAgent,
      { patientCode, name: `${data.first_name} ${data.last_name}`, phone: data.phone },
      conn
    );

    return {
      id: newPatientId,
      patientCode,
      patient_code: patientCode,
      fullName: `${data.first_name.trim()} ${data.last_name.trim()}`,
      phone: data.phone,
      email: data.email,
      status: data.status || 'active'
    };
  });
}

/**
 * Update Existing Patient Record
 */
async function updatePatient(patientId, data, actorUser, ip = null, userAgent = null) {
  const [existing] = await db.query('SELECT * FROM patients WHERE id = ? LIMIT 1', [patientId]);
  if (existing.length === 0) {
    throw new NotFoundError('Patient record not found.');
  }

  // Check unique CNIC if changed
  if (data.identification_number && data.identification_number !== existing[0].identification_number) {
    const [dup] = await db.query(
      'SELECT id, patient_code FROM patients WHERE identification_number = ? AND id != ? LIMIT 1',
      [data.identification_number.trim(), patientId]
    );
    if (dup.length > 0) {
      throw new ConflictError(`Identification number '${data.identification_number}' is already registered to ${dup[0].patient_code}.`);
    }
  }

  const updates = [];
  const params = [];

  const fields = [
    'first_name', 'last_name', 'gender', 'date_of_birth', 'blood_group',
    'phone', 'email', 'address', 'identification_number', 'emergency_contact_name',
    'emergency_contact_phone', 'emergency_contact_relation', 'allergies',
    'medical_history', 'registration_date', 'status', 'profile_image',
    'marital_status', 'occupation', 'insurance_provider', 'insurance_policy_number'
  ];

  for (const field of fields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(typeof data[field] === 'string' ? data[field].trim() : data[field]);
    }
  }

  if (updates.length > 0) {
    params.push(patientId);
    await db.query(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  // Sync with users table if patient is linked to user account
  if (existing[0].user_id && (data.first_name || data.last_name || data.phone || data.email)) {
    const userUpdates = [];
    const userParams = [];
    if (data.first_name || data.last_name) {
      const fName = data.first_name || existing[0].first_name;
      const lName = data.last_name || existing[0].last_name;
      userUpdates.push('full_name = ?');
      userParams.push(`${fName} ${lName}`.trim());
    }
    if (data.phone) {
      userUpdates.push('phone = ?');
      userParams.push(data.phone.trim());
    }
    if (userUpdates.length > 0) {
      userParams.push(existing[0].user_id);
      await db.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userParams);
    }
  }

  await logger.audit(
    actorUser?.id || null,
    'PATIENT_UPDATED',
    'patients',
    patientId,
    ip,
    userAgent,
    { updatedFields: Object.keys(data) }
  );

  return await getPatientById(patientId, actorUser);
}

/**
 * Activate / Deactivate Patient
 */
async function togglePatientStatus(patientId, status, actorUser, ip = null, userAgent = null) {
  const [existing] = await db.query('SELECT id, status, patient_code, first_name, last_name, user_id FROM patients WHERE id = ? LIMIT 1', [patientId]);
  if (existing.length === 0) {
    throw new NotFoundError('Patient record not found.');
  }

  await db.query('UPDATE patients SET status = ? WHERE id = ?', [status, patientId]);

  // If status is suspended or inactive, optionally sync linked user status
  if (existing[0].user_id) {
    const userStatus = status === 'active' ? 'active' : (status === 'suspended' ? 'suspended' : 'inactive');
    await db.query('UPDATE users SET status = ? WHERE id = ?', [userStatus, existing[0].user_id]);
  }

  await logger.audit(
    actorUser?.id || null,
    'PATIENT_STATUS_CHANGED',
    'patients',
    patientId,
    ip,
    userAgent,
    { previousStatus: existing[0].status, newStatus: status, patientCode: existing[0].patient_code }
  );

  return {
    patientId,
    patientCode: existing[0].patient_code,
    status,
    message: `Patient ${existing[0].patient_code} status successfully updated to ${status}.`
  };
}

/**
 * Delete / Archive Patient
 */
async function deletePatient(patientId, actorUser, ip = null, userAgent = null) {
  const [existing] = await db.query('SELECT id, patient_code, first_name, last_name FROM patients WHERE id = ? LIMIT 1', [patientId]);
  if (existing.length === 0) {
    throw new NotFoundError('Patient record not found.');
  }

  // Soft delete / mark inactive to preserve medical history and invoice ledger
  await db.query("UPDATE patients SET status = 'inactive' WHERE id = ?", [patientId]);

  await logger.audit(
    actorUser?.id || null,
    'PATIENT_ARCHIVED',
    'patients',
    patientId,
    ip,
    userAgent,
    { patientCode: existing[0].patient_code }
  );

  return {
    message: `Patient record ${existing[0].patient_code} has been archived/deactivated.`,
    patientId
  };
}

/**
 * Add Patient Document
 */
async function addPatientDocument(patientId, docData, actorUser, ip = null, userAgent = null) {
  await enforcePatientAccess(patientId, actorUser);

  const [res] = await db.query(
    `INSERT INTO patient_documents (patient_id, document_name, document_type, file_path, file_size_kb, uploaded_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      patientId,
      docData.document_name.trim(),
      docData.document_type.trim(),
      docData.file_path.trim(),
      docData.file_size_kb || 150,
      actorUser?.id || null,
      docData.notes ? docData.notes.trim() : null
    ]
  );

  await logger.audit(
    actorUser?.id || null,
    'PATIENT_DOCUMENT_ADDED',
    'patient_documents',
    res.insertId,
    ip,
    userAgent,
    { patientId, documentName: docData.document_name }
  );

  return { id: res.insertId, ...docData, message: 'Document added successfully.' };
}

/**
 * Delete Patient Document
 */
async function deletePatientDocument(docId, patientId, actorUser, ip = null, userAgent = null) {
  await enforcePatientAccess(patientId, actorUser);

  const [existing] = await db.query(
    'SELECT id, document_name FROM patient_documents WHERE id = ? AND patient_id = ? LIMIT 1',
    [docId, patientId]
  );
  if (existing.length === 0) {
    throw new NotFoundError('Document not found for this patient.');
  }

  await db.query('DELETE FROM patient_documents WHERE id = ?', [docId]);

  await logger.audit(
    actorUser?.id || null,
    'PATIENT_DOCUMENT_DELETED',
    'patient_documents',
    docId,
    ip,
    userAgent,
    { patientId, documentName: existing[0].document_name }
  );

  return { message: 'Document removed successfully.', docId };
}

/**
 * Add Medical Record (EMR)
 */
async function addMedicalRecord(patientId, recordData, actorUser, ip = null, userAgent = null) {
  // Check patient exists
  const [patient] = await db.query('SELECT id FROM patients WHERE id = ? LIMIT 1', [patientId]);
  if (patient.length === 0) {
    throw new NotFoundError('Patient not found.');
  }

  // Get doctor ID
  let doctorId = recordData.doctor_id;
  if (!doctorId && actorUser?.role === 'doctor') {
    const [doc] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [actorUser.id]);
    doctorId = doc[0]?.id || 1;
  }
  if (!doctorId) doctorId = 1;

  const [res] = await db.query(
    `INSERT INTO medical_records (patient_id, doctor_id, appointment_id, record_date, chief_complaint, diagnosis, vitals_json, clinical_notes, follow_up_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      patientId,
      doctorId,
      recordData.appointment_id || null,
      recordData.record_date || new Date().toISOString().split('T')[0],
      recordData.chief_complaint.trim(),
      recordData.diagnosis.trim(),
      recordData.vitals_json ? JSON.stringify(recordData.vitals_json) : null,
      recordData.clinical_notes ? recordData.clinical_notes.trim() : null,
      recordData.follow_up_date || null
    ]
  );

  const recordId = res.insertId;

  // If prescriptions included, insert them
  if (Array.isArray(recordData.prescriptions) && recordData.prescriptions.length > 0) {
    for (const rx of recordData.prescriptions) {
      if (rx.medicine_name) {
        await db.query(
          `INSERT INTO prescriptions (record_id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, instructions)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recordId,
            patientId,
            doctorId,
            rx.medicine_name.trim(),
            rx.dosage || 'Standard',
            rx.frequency || 'Once daily',
            rx.duration || '7 Days',
            rx.instructions || null
          ]
        );
      }
    }
  }

  await logger.audit(actorUser?.id || null, 'MEDICAL_RECORD_CREATED', 'medical_records', recordId, ip, userAgent, {
    patientId,
    diagnosis: recordData.diagnosis
  });

  return { id: recordId, message: 'Medical record created successfully.' };
}

/**
 * Add Prescription
 */
async function addPrescription(patientId, rxData, actorUser, ip = null, userAgent = null) {
  let doctorId = rxData.doctor_id;
  if (!doctorId && actorUser?.role === 'doctor') {
    const [doc] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [actorUser.id]);
    doctorId = doc[0]?.id || 1;
  }
  if (!doctorId) doctorId = 1;

  const [res] = await db.query(
    `INSERT INTO prescriptions (record_id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, instructions)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      rxData.record_id || null,
      patientId,
      doctorId,
      rxData.medicine_name.trim(),
      rxData.dosage.trim(),
      rxData.frequency.trim(),
      rxData.duration.trim(),
      rxData.instructions ? rxData.instructions.trim() : null
    ]
  );

  await logger.audit(actorUser?.id || null, 'PRESCRIPTION_CREATED', 'prescriptions', res.insertId, ip, userAgent, {
    patientId,
    medicineName: rxData.medicine_name
  });

  return { id: res.insertId, message: 'Prescription added successfully.' };
}

/**
 * Add Patient Vitals Recording
 */
async function addPatientVitals(patientId, vitalsData, actorUser, ip = null, userAgent = null) {
  // Calculate BMI if weight and height given
  let bmi = null;
  if (vitalsData.weight_kg && vitalsData.height_cm && vitalsData.height_cm > 0) {
    const heightInMeters = vitalsData.height_cm / 100;
    bmi = parseFloat((vitalsData.weight_kg / (heightInMeters * heightInMeters)).toFixed(1));
  }

  const [res] = await db.query(
    `INSERT INTO vitals (patient_id, recorded_by, systolic, diastolic, heart_rate, temperature, respiratory_rate, oxygen_saturation, blood_sugar, weight_kg, height_cm, bmi, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      patientId,
      actorUser?.id || null,
      vitalsData.systolic || null,
      vitalsData.diastolic || null,
      vitalsData.heart_rate || null,
      vitalsData.temperature || null,
      vitalsData.respiratory_rate || null,
      vitalsData.oxygen_saturation || null,
      vitalsData.blood_sugar || null,
      vitalsData.weight_kg || null,
      vitalsData.height_cm || null,
      bmi || vitalsData.bmi || null,
      vitalsData.notes ? vitalsData.notes.trim() : null
    ]
  );

  await logger.audit(actorUser?.id || null, 'VITALS_RECORDED', 'vitals', res.insertId, ip, userAgent, {
    patientId,
    systolic: vitalsData.systolic,
    diastolic: vitalsData.diastolic
  });

  return { id: res.insertId, bmi, message: 'Vitals recorded successfully.' };
}

module.exports = {
  listPatients,
  getPatientById,
  getPatientAppointments,
  getPatientVisits,
  getPatientMedicalRecords,
  getPatientPrescriptions,
  getPatientLabReports,
  getPatientInvoices,
  getPatientPayments,
  getPatientDocuments,
  getPatientVitals,
  createPatient,
  updatePatient,
  togglePatientStatus,
  deletePatient,
  addPatientDocument,
  deletePatientDocument,
  addMedicalRecord,
  addPrescription,
  addPatientVitals
};
