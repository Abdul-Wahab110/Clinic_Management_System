const db = require('../config/db');
const bcrypt = require('bcryptjs');

const DOCTOR_ROLE_ID = 3;

/**
 * Generate next Doctor Code (e.g., DOC-2026-0009)
 */
async function generateDoctorCode() {
  const currentYear = new Date().getFullYear();
  const prefix = `DOC-${currentYear}-`;

  const [rows] = await db.query(
    'SELECT doctor_code FROM doctors WHERE doctor_code LIKE ? ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (rows.length > 0 && rows[0].doctor_code) {
    const parts = rows[0].doctor_code.split('-');
    if (parts.length === 3) {
      const lastNum = parseInt(parts[2], 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

/**
 * Get Paginated & Filtered Doctors
 */
async function getDoctors(filters = {}, pagination = {}) {
  const {
    search,
    department_id,
    specialization,
    status,
    min_fee,
    max_fee,
    min_experience,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = filters;

  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 10));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (search) {
    conditions.push(`(
      u.full_name LIKE ? OR 
      doc.doctor_code LIKE ? OR 
      doc.specialization LIKE ? OR 
      doc.qualification LIKE ? OR 
      doc.license_number LIKE ? OR 
      u.email LIKE ? OR 
      u.phone LIKE ?
    )`);
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s, s);
  }

  if (department_id && department_id !== 'all') {
    conditions.push('doc.department_id = ?');
    params.push(department_id);
  }

  if (specialization && specialization !== 'all') {
    conditions.push('doc.specialization LIKE ?');
    params.push(`%${specialization}%`);
  }

  if (status && status !== 'all') {
    conditions.push('doc.status = ?');
    params.push(status);
  }

  if (min_fee !== undefined && min_fee !== '' && !isNaN(min_fee)) {
    conditions.push('doc.consultation_fee >= ?');
    params.push(parseFloat(min_fee));
  }

  if (max_fee !== undefined && max_fee !== '' && !isNaN(max_fee)) {
    conditions.push('doc.consultation_fee <= ?');
    params.push(parseFloat(max_fee));
  }

  if (min_experience !== undefined && min_experience !== '' && !isNaN(min_experience)) {
    conditions.push('doc.experience_years >= ?');
    params.push(parseInt(min_experience, 10));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Allowed Sort Fields
  const sortMap = {
    'created_at': 'doc.created_at',
    'name': 'u.full_name',
    'full_name': 'u.full_name',
    'doctor_code': 'doc.doctor_code',
    'consultation_fee': 'doc.consultation_fee',
    'experience_years': 'doc.experience_years',
    'specialization': 'doc.specialization'
  };
  const sortColumn = sortMap[sortBy] || 'doc.created_at';
  const order = (sortOrder && sortOrder.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';

  // Count total matching doctors
  const [countResult] = await db.query(
    `SELECT COUNT(*) as total 
     FROM doctors doc
     JOIN users u ON doc.user_id = u.id
     JOIN departments dept ON doc.department_id = dept.id
     ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // Fetch paginated doctors
  const [doctors] = await db.query(
    `SELECT 
        doc.id,
        doc.user_id,
        doc.doctor_code,
        u.full_name as name,
        u.email,
        u.phone,
        u.avatar_url,
        doc.profile_image,
        doc.department_id,
        dept.name as department_name,
        dept.code as department_code,
        doc.specialization,
        doc.qualification,
        doc.license_number,
        doc.experience_years,
        doc.consultation_fee,
        doc.room_number,
        doc.bio,
        doc.status,
        doc.is_available,
        doc.created_at,
        doc.updated_at
     FROM doctors doc
     JOIN users u ON doc.user_id = u.id
     JOIN departments dept ON doc.department_id = dept.id
     ${whereClause}
     ORDER BY ${sortColumn} ${order}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Attach active schedules summary for each doctor
  for (const doc of doctors) {
    const [schedules] = await db.query(
      `SELECT day_of_week, start_time, end_time, slot_duration_minutes, max_patients, is_active
       FROM doctor_schedules
       WHERE doctor_id = ? AND is_active = 1
       ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`,
      [doc.id]
    );
    doc.schedules = schedules;
  }

  return {
    doctors,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get Full Doctor Details by ID
 */
async function getDoctorById(id) {
  const [doctors] = await db.query(
    `SELECT 
        doc.id,
        doc.user_id,
        doc.doctor_code,
        u.full_name as name,
        u.email,
        u.phone,
        u.avatar_url,
        doc.profile_image,
        doc.department_id,
        dept.name as department_name,
        dept.code as department_code,
        dept.description as department_description,
        doc.specialization,
        doc.qualification,
        doc.license_number,
        doc.experience_years,
        doc.consultation_fee,
        doc.room_number,
        doc.bio,
        doc.status,
        doc.is_available,
        doc.created_at,
        doc.updated_at
     FROM doctors doc
     JOIN users u ON doc.user_id = u.id
     JOIN departments dept ON doc.department_id = dept.id
     WHERE doc.id = ? OR doc.doctor_code = ? LIMIT 1`,
    [id, id]
  );

  if (doctors.length === 0) return null;
  const doctor = doctors[0];

  // 1. Weekly Schedules
  const [schedules] = await db.query(
    `SELECT id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients, is_active
     FROM doctor_schedules
     WHERE doctor_id = ?
     ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`,
    [doctor.id]
  );
  doctor.schedules = schedules;

  // 2. Consultation Metrics
  const [statsRows] = await db.query(
    `SELECT 
        COUNT(*) as total_appointments,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_consultations,
        SUM(CASE WHEN status IN ('confirmed', 'pending', 'checked_in') THEN 1 ELSE 0 END) as upcoming_consultations,
        COUNT(DISTINCT patient_id) as total_unique_patients
     FROM appointments 
     WHERE doctor_id = ?`,
    [doctor.id]
  );
  doctor.stats = statsRows[0] || {
    total_appointments: 0,
    completed_consultations: 0,
    upcoming_consultations: 0,
    total_unique_patients: 0
  };

  // 3. Recent Consultations / Appointments (Last 10)
  const [recentAppointments] = await db.query(
    `SELECT 
        a.id,
        a.appointment_number,
        a.appointment_date,
        a.appointment_time,
        a.reason,
        a.status,
        p.id as patient_id,
        p.patient_code,
        p.first_name,
        p.last_name,
        p.phone as patient_phone,
        p.blood_group
     FROM appointments a
     JOIN patients p ON a.patient_id = p.id
     WHERE a.doctor_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC
     LIMIT 10`,
    [doctor.id]
  );
  doctor.recent_appointments = recentAppointments;

  return doctor;
}

/**
 * Create Doctor with User Account & Schedules
 */
async function createDoctor(doctorData, actorUser = null) {
  const {
    first_name,
    last_name,
    email,
    phone,
    password,
    department_id,
    specialization,
    qualification,
    license_number,
    experience_years = 0,
    consultation_fee = 50.00,
    room_number,
    bio,
    status = 'active',
    profile_image,
    schedules = []
  } = doctorData;

  const fullName = `${first_name.trim()} ${last_name.trim()}`;
  const docCode = await generateDoctorCode();

  // Check if email already exists
  const [existingUser] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existingUser.length > 0) {
    const error = new Error(`A user account with email "${email}" already exists.`);
    error.statusCode = 409;
    throw error;
  }

  // Hash password
  const rawPassword = password || 'Clinic2026!';
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  // 1. Create User
  const [userResult] = await db.query(
    `INSERT INTO users (full_name, email, password_hash, role_id, phone, avatar_url, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      fullName,
      email,
      passwordHash,
      DOCTOR_ROLE_ID,
      phone,
      profile_image || null,
      status === 'inactive' ? 'inactive' : 'active'
    ]
  );
  const userId = userResult.insertId;

  // 2. Create Doctor
  const [docResult] = await db.query(
    `INSERT INTO doctors 
     (user_id, doctor_code, department_id, specialization, qualification, license_number, 
      experience_years, consultation_fee, room_number, bio, status, is_available, profile_image) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      docCode,
      department_id,
      specialization,
      qualification,
      license_number || null,
      experience_years,
      consultation_fee,
      room_number || null,
      bio || null,
      status,
      status === 'active' ? 1 : 0,
      profile_image || null
    ]
  );
  const doctorId = docResult.insertId;

  // 3. Initialize Schedules
  const defaultSchedules = schedules.length > 0 ? schedules : [
    { day_of_week: 'Monday', start_time: '09:00:00', end_time: '14:00:00', slot_duration_minutes: 20, max_patients: 15, is_active: true },
    { day_of_week: 'Tuesday', start_time: '09:00:00', end_time: '14:00:00', slot_duration_minutes: 20, max_patients: 15, is_active: true },
    { day_of_week: 'Wednesday', start_time: '09:00:00', end_time: '14:00:00', slot_duration_minutes: 20, max_patients: 15, is_active: true },
    { day_of_week: 'Thursday', start_time: '09:00:00', end_time: '14:00:00', slot_duration_minutes: 20, max_patients: 15, is_active: true },
    { day_of_week: 'Friday', start_time: '09:00:00', end_time: '13:00:00', slot_duration_minutes: 20, max_patients: 12, is_active: true }
  ];

  for (const s of defaultSchedules) {
    await db.query(
      `INSERT INTO doctor_schedules 
       (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        doctorId,
        s.day_of_week,
        s.start_time,
        s.end_time,
        s.slot_duration_minutes || 20,
        s.max_patients || 20,
        s.is_active ? 1 : 0
      ]
    );
  }

  // 4. Audit Log
  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'CREATE_DOCTOR', 'DOCTOR', ?, ?)`,
      [actorUser.id, doctorId, JSON.stringify({ doctorCode: docCode, fullName, email, specialization })]
    ).catch(() => {});
  }

  return getDoctorById(doctorId);
}

/**
 * Update Doctor Profile & Credentials
 */
async function updateDoctor(id, doctorData, actorUser = null) {
  const doctor = await getDoctorById(id);
  if (!doctor) {
    const error = new Error('Doctor record not found.');
    error.statusCode = 404;
    throw error;
  }

  const {
    first_name,
    last_name,
    name,
    email,
    phone,
    department_id,
    specialization,
    qualification,
    license_number,
    experience_years,
    consultation_fee,
    room_number,
    bio,
    status,
    profile_image
  } = doctorData;

  let fullName = doctor.name;
  if (first_name && last_name) {
    fullName = `${first_name.trim()} ${last_name.trim()}`;
  } else if (name) {
    fullName = name.trim();
  }

  // Update User Account
  await db.query(
    `UPDATE users 
     SET full_name = COALESCE(?, full_name), 
         email = COALESCE(?, email), 
         phone = COALESCE(?, phone), 
         avatar_url = COALESCE(?, avatar_url),
         status = COALESCE(?, status)
     WHERE id = ?`,
    [
      fullName,
      email || null,
      phone || null,
      profile_image || null,
      status ? (status === 'inactive' ? 'inactive' : 'active') : null,
      doctor.user_id
    ]
  );

  // Update Doctor Record
  await db.query(
    `UPDATE doctors 
     SET department_id = COALESCE(?, department_id),
         specialization = COALESCE(?, specialization),
         qualification = COALESCE(?, qualification),
         license_number = COALESCE(?, license_number),
         experience_years = COALESCE(?, experience_years),
         consultation_fee = COALESCE(?, consultation_fee),
         room_number = COALESCE(?, room_number),
         bio = COALESCE(?, bio),
         status = COALESCE(?, status),
         is_available = COALESCE(?, is_available),
         profile_image = COALESCE(?, profile_image)
     WHERE id = ?`,
    [
      department_id || null,
      specialization || null,
      qualification || null,
      license_number !== undefined ? license_number : null,
      experience_years !== undefined ? experience_years : null,
      consultation_fee !== undefined ? consultation_fee : null,
      room_number !== undefined ? room_number : null,
      bio !== undefined ? bio : null,
      status || null,
      status ? (status === 'active' ? 1 : 0) : null,
      profile_image !== undefined ? profile_image : null,
      doctor.id
    ]
  );

  // Audit Log
  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'UPDATE_DOCTOR', 'DOCTOR', ?, ?)`,
      [actorUser.id, doctor.id, JSON.stringify({ doctorCode: doctor.doctor_code, updatedFields: Object.keys(doctorData) })]
    ).catch(() => {});
  }

  return getDoctorById(doctor.id);
}

/**
 * Update Doctor Status (Active / Inactive / On Leave / Suspended)
 */
async function updateDoctorStatus(id, status, actorUser = null) {
  const doctor = await getDoctorById(id);
  if (!doctor) {
    const error = new Error('Doctor record not found.');
    error.statusCode = 404;
    throw error;
  }

  const isAvailable = status === 'active' ? 1 : 0;
  const userStatus = status === 'inactive' || status === 'suspended' ? 'inactive' : 'active';

  await db.query('UPDATE doctors SET status = ?, is_available = ? WHERE id = ?', [status, isAvailable, doctor.id]);
  await db.query('UPDATE users SET status = ? WHERE id = ?', [userStatus, doctor.user_id]);

  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'UPDATE_DOCTOR_STATUS', 'DOCTOR', ?, ?)`,
      [actorUser.id, doctor.id, JSON.stringify({ oldStatus: doctor.status, newStatus: status })]
    ).catch(() => {});
  }

  return { id: doctor.id, doctor_code: doctor.doctor_code, status, is_available: isAvailable };
}

/**
 * Get Weekly Schedules for Doctor
 */
async function getDoctorSchedules(doctorId) {
  const [schedules] = await db.query(
    `SELECT id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients, is_active
     FROM doctor_schedules
     WHERE doctor_id = ?
     ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`,
    [doctorId]
  );
  return schedules;
}

/**
 * Bulk Upsert / Replace Doctor Weekly Schedules
 */
async function updateDoctorSchedules(doctorId, schedulesList, actorUser = null) {
  const doctor = await getDoctorById(doctorId);
  if (!doctor) {
    const error = new Error('Doctor record not found.');
    error.statusCode = 404;
    throw error;
  }

  for (const s of schedulesList) {
    await db.query(
      `INSERT INTO doctor_schedules 
       (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       start_time = VALUES(start_time), 
       end_time = VALUES(end_time), 
       slot_duration_minutes = VALUES(slot_duration_minutes), 
       max_patients = VALUES(max_patients), 
       is_active = VALUES(is_active)`,
      [
        doctor.id,
        s.day_of_week,
        s.start_time,
        s.end_time,
        s.slot_duration_minutes || 20,
        s.max_patients || 20,
        s.is_active !== undefined ? (s.is_active ? 1 : 0) : 1
      ]
    );
  }

  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'UPDATE_DOCTOR_SCHEDULES', 'DOCTOR', ?, ?)`,
      [actorUser.id, doctor.id, JSON.stringify({ slotsCount: schedulesList.length })]
    ).catch(() => {});
  }

  return getDoctorSchedules(doctor.id);
}

/**
 * Delete / Deactivate Doctor
 */
async function deleteDoctor(id, actorUser = null) {
  const doctor = await getDoctorById(id);
  if (!doctor) {
    const error = new Error('Doctor record not found.');
    error.statusCode = 404;
    throw error;
  }

  await db.query('UPDATE doctors SET status = "inactive", is_available = 0 WHERE id = ?', [doctor.id]);
  await db.query('UPDATE users SET status = "inactive" WHERE id = ?', [doctor.user_id]);

  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'DELETE_DOCTOR', 'DOCTOR', ?, ?)`,
      [actorUser.id, doctor.id, JSON.stringify({ doctorCode: doctor.doctor_code })]
    ).catch(() => {});
  }

  return { success: true, message: `Doctor ${doctor.name} (${doctor.doctor_code}) deactivated successfully.` };
}

/**
 * Aggregated Doctor Module Statistics
 */
async function getDoctorStats() {
  const [stats] = await db.query(`
    SELECT 
      COUNT(*) as total_doctors,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_doctors,
      SUM(CASE WHEN status = 'on_leave' THEN 1 ELSE 0 END) as on_leave_doctors,
      SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_doctors,
      ROUND(AVG(consultation_fee), 2) as avg_consultation_fee,
      COUNT(DISTINCT department_id) as total_departments
    FROM doctors
  `);

  return stats[0] || {
    total_doctors: 0,
    active_doctors: 0,
    on_leave_doctors: 0,
    inactive_doctors: 0,
    avg_consultation_fee: 0,
    total_departments: 0
  };
}

/**
 * Get Active Departments List for Selection Dropdowns
 */
async function getDepartments() {
  const [departments] = await db.query(
    `SELECT id, code, name, description, is_active 
     FROM departments 
     WHERE is_active = 1 
     ORDER BY name ASC`
  );
  return departments;
}

module.exports = {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  updateDoctorStatus,
  getDoctorSchedules,
  updateDoctorSchedules,
  deleteDoctor,
  getDoctorStats,
  getDepartments,
  generateDoctorCode
};
