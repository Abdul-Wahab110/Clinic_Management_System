const db = require('../config/db');

/**
 * Get Paginated & Filtered Hospital Departments
 */
async function getDepartments(filters = {}, pagination = {}) {
  const {
    search,
    status,
    emergency_only,
    sortBy = 'name',
    sortOrder = 'ASC'
  } = filters;

  const page = Math.max(1, parseInt(pagination.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (search) {
    conditions.push(`(
      dept.name LIKE ? OR 
      dept.code LIKE ? OR 
      dept.description LIKE ? OR 
      dept.floor_location LIKE ?
    )`);
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (status !== undefined && status !== 'all' && status !== '') {
    if (status === 'active' || status === '1' || status === true) {
      conditions.push('dept.is_active = 1');
    } else if (status === 'inactive' || status === '0' || status === false) {
      conditions.push('dept.is_active = 0');
    }
  }

  if (emergency_only === '1' || emergency_only === 'true' || emergency_only === true) {
    conditions.push('dept.emergency_available = 1');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching
  const [countResult] = await db.query(
    `SELECT COUNT(*) as total FROM departments dept ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // Sorting
  const sortMap = {
    'name': 'dept.name',
    'code': 'dept.code',
    'created_at': 'dept.created_at',
    'consultation_base_fee': 'dept.consultation_base_fee'
  };
  const sortColumn = sortMap[sortBy] || 'dept.name';
  const order = (sortOrder && sortOrder.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';

  // Fetch departments with aggregated doctor counts and head doctor info
  const [departments] = await db.query(
    `SELECT 
        dept.id,
        dept.code,
        dept.name,
        dept.description,
        dept.icon,
        dept.floor_location,
        dept.phone,
        dept.email,
        dept.emergency_available,
        dept.consultation_base_fee,
        dept.head_doctor_id,
        dept.is_active,
        dept.created_at,
        dept.updated_at,
        u_head.full_name as head_doctor_name,
        d_head.doctor_code as head_doctor_code,
        d_head.specialization as head_doctor_specialization,
        (SELECT COUNT(*) FROM doctors doc WHERE doc.department_id = dept.id) as doctors_count,
        (SELECT COUNT(*) FROM doctors doc WHERE doc.department_id = dept.id AND doc.status = 'active') as active_doctors_count
     FROM departments dept
     LEFT JOIN doctors d_head ON dept.head_doctor_id = d_head.id
     LEFT JOIN users u_head ON d_head.user_id = u_head.id
     ${whereClause}
     ORDER BY ${sortColumn} ${order}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Attach preview avatars of up to 4 doctors for each department
  for (const dept of departments) {
    const [doctorsPreview] = await db.query(
      `SELECT doc.id, doc.doctor_code, u.full_name as name, doc.specialization, doc.status
       FROM doctors doc
       JOIN users u ON doc.user_id = u.id
       WHERE doc.department_id = ?
       LIMIT 4`,
      [dept.id]
    );
    dept.doctors_preview = doctorsPreview;
  }

  return {
    departments,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get Comprehensive Department File by ID or Code
 */
async function getDepartmentById(id) {
  const [departments] = await db.query(
    `SELECT 
        dept.id,
        dept.code,
        dept.name,
        dept.description,
        dept.icon,
        dept.floor_location,
        dept.phone,
        dept.email,
        dept.emergency_available,
        dept.consultation_base_fee,
        dept.head_doctor_id,
        dept.is_active,
        dept.created_at,
        dept.updated_at,
        u_head.full_name as head_doctor_name,
        u_head.email as head_doctor_email,
        u_head.phone as head_doctor_phone,
        d_head.doctor_code as head_doctor_code,
        d_head.specialization as head_doctor_specialization,
        d_head.qualification as head_doctor_qualification
     FROM departments dept
     LEFT JOIN doctors d_head ON dept.head_doctor_id = d_head.id
     LEFT JOIN users u_head ON d_head.user_id = u_head.id
     WHERE dept.id = ? OR dept.code = ? LIMIT 1`,
    [id, id]
  );

  if (departments.length === 0) return null;
  const dept = departments[0];

  // 1. Assigned Faculty Doctors List with Schedules
  const [assignedDoctors] = await db.query(
    `SELECT 
        doc.id,
        doc.doctor_code,
        u.full_name as name,
        u.email,
        u.phone,
        doc.specialization,
        doc.qualification,
        doc.license_number,
        doc.experience_years,
        doc.consultation_fee,
        doc.room_number,
        doc.status,
        doc.is_available
     FROM doctors doc
     JOIN users u ON doc.user_id = u.id
     WHERE doc.department_id = ?
     ORDER BY u.full_name ASC`,
    [dept.id]
  );

  for (const doc of assignedDoctors) {
    const [schedules] = await db.query(
      `SELECT day_of_week, start_time, end_time, slot_duration_minutes, max_patients, is_active
       FROM doctor_schedules
       WHERE doctor_id = ? AND is_active = 1
       ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`,
      [doc.id]
    );
    doc.schedules = schedules;
  }
  dept.doctors = assignedDoctors;

  // 2. Department Clinical Statistics
  const [statsRows] = await db.query(
    `SELECT 
        COUNT(*) as total_appointments,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_appointments,
        SUM(CASE WHEN status IN ('confirmed', 'pending', 'checked_in') THEN 1 ELSE 0 END) as upcoming_appointments,
        COUNT(DISTINCT patient_id) as total_unique_patients
     FROM appointments
     WHERE department_id = ?`,
    [dept.id]
  );

  dept.stats = {
    total_doctors: assignedDoctors.length,
    active_doctors: assignedDoctors.filter(d => d.status === 'active').length,
    total_appointments: statsRows[0]?.total_appointments || 0,
    completed_appointments: statsRows[0]?.completed_appointments || 0,
    upcoming_appointments: statsRows[0]?.upcoming_appointments || 0,
    total_unique_patients: statsRows[0]?.total_unique_patients || 0
  };

  // 3. Recent Appointments in Department (Last 10)
  const [recentAppointments] = await db.query(
    `SELECT 
        a.id,
        a.appointment_number,
        a.appointment_date,
        a.appointment_time,
        a.reason,
        a.status,
        u_doc.full_name as doctor_name,
        d.doctor_code,
        p.id as patient_id,
        p.patient_code,
        p.first_name,
        p.last_name,
        p.phone as patient_phone
     FROM appointments a
     JOIN doctors d ON a.doctor_id = d.id
     JOIN users u_doc ON d.user_id = u_doc.id
     JOIN patients p ON a.patient_id = p.id
     WHERE a.department_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC
     LIMIT 10`,
    [dept.id]
  );
  dept.recent_appointments = recentAppointments;

  return dept;
}

/**
 * Create New Department Dynamically
 */
async function createDepartment(deptData, actorUser = null) {
  const {
    name,
    code,
    description,
    icon = 'fa-hospital',
    floor_location,
    phone,
    email,
    emergency_available = 0,
    consultation_base_fee = 50.00,
    head_doctor_id = null,
    is_active = 1
  } = deptData;

  const cleanCode = code.trim().toUpperCase();
  const cleanName = name.trim();

  // Check unique constraints
  const [existing] = await db.query(
    'SELECT id, name, code FROM departments WHERE code = ? OR name = ?',
    [cleanCode, cleanName]
  );

  if (existing.length > 0) {
    const error = new Error(`A department with name "${cleanName}" or code "${cleanCode}" already exists.`);
    error.statusCode = 409;
    throw error;
  }

  const [result] = await db.query(
    `INSERT INTO departments 
     (name, code, description, icon, floor_location, phone, email, emergency_available, consultation_base_fee, head_doctor_id, is_active) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cleanName,
      cleanCode,
      description ? description.trim() : null,
      icon ? icon.trim() : 'fa-hospital',
      floor_location ? floor_location.trim() : null,
      phone ? phone.trim() : null,
      email ? email.trim() : null,
      emergency_available ? 1 : 0,
      parseFloat(consultation_base_fee) || 50.00,
      head_doctor_id ? parseInt(head_doctor_id, 10) : null,
      is_active ? 1 : 0
    ]
  );

  const deptId = result.insertId;

  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'CREATE_DEPARTMENT', 'DEPARTMENT', ?, ?)`,
      [actorUser.id, deptId, JSON.stringify({ code: cleanCode, name: cleanName })]
    ).catch(() => {});
  }

  return getDepartmentById(deptId);
}

/**
 * Update Department Configuration
 */
async function updateDepartment(id, deptData, actorUser = null) {
  const dept = await getDepartmentById(id);
  if (!dept) {
    const error = new Error('Department record not found.');
    error.statusCode = 404;
    throw error;
  }

  const {
    name,
    code,
    description,
    icon,
    floor_location,
    phone,
    email,
    emergency_available,
    consultation_base_fee,
    head_doctor_id,
    is_active
  } = deptData;

  const cleanCode = code ? code.trim().toUpperCase() : dept.code;
  const cleanName = name ? name.trim() : dept.name;

  // Check unique constraints if name/code modified
  if (cleanCode !== dept.code || cleanName !== dept.name) {
    const [existing] = await db.query(
      'SELECT id FROM departments WHERE (code = ? OR name = ?) AND id != ?',
      [cleanCode, cleanName, dept.id]
    );
    if (existing.length > 0) {
      const error = new Error(`Another department with code "${cleanCode}" or name "${cleanName}" already exists.`);
      error.statusCode = 409;
      throw error;
    }
  }

  await db.query(
    `UPDATE departments 
     SET name = COALESCE(?, name),
         code = COALESCE(?, code),
         description = COALESCE(?, description),
         icon = COALESCE(?, icon),
         floor_location = COALESCE(?, floor_location),
         phone = COALESCE(?, phone),
         email = COALESCE(?, email),
         emergency_available = COALESCE(?, emergency_available),
         consultation_base_fee = COALESCE(?, consultation_base_fee),
         head_doctor_id = COALESCE(?, head_doctor_id),
         is_active = COALESCE(?, is_active)
     WHERE id = ?`,
    [
      name ? cleanName : null,
      code ? cleanCode : null,
      description !== undefined ? description : null,
      icon !== undefined ? icon : null,
      floor_location !== undefined ? floor_location : null,
      phone !== undefined ? phone : null,
      email !== undefined ? email : null,
      emergency_available !== undefined ? (emergency_available ? 1 : 0) : null,
      consultation_base_fee !== undefined ? parseFloat(consultation_base_fee) : null,
      head_doctor_id !== undefined ? (head_doctor_id ? parseInt(head_doctor_id, 10) : null) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      dept.id
    ]
  );

  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'UPDATE_DEPARTMENT', 'DEPARTMENT', ?, ?)`,
      [actorUser.id, dept.id, JSON.stringify({ code: cleanCode, updatedFields: Object.keys(deptData) })]
    ).catch(() => {});
  }

  return getDepartmentById(dept.id);
}

/**
 * Activate / Deactivate Department
 */
async function updateDepartmentStatus(id, isActive, actorUser = null) {
  const dept = await getDepartmentById(id);
  if (!dept) {
    const error = new Error('Department record not found.');
    error.statusCode = 404;
    throw error;
  }

  const activeVal = isActive ? 1 : 0;
  await db.query('UPDATE departments SET is_active = ? WHERE id = ?', [activeVal, dept.id]);

  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'UPDATE_DEPARTMENT_STATUS', 'DEPARTMENT', ?, ?)`,
      [actorUser.id, dept.id, JSON.stringify({ oldActive: dept.is_active, newActive: activeVal })]
    ).catch(() => {});
  }

  return { id: dept.id, code: dept.code, name: dept.name, is_active: activeVal };
}

/**
 * Delete Department (Safely validates dependencies or transfers)
 */
async function deleteDepartment(id, fallbackDepartmentId = null, actorUser = null) {
  const dept = await getDepartmentById(id);
  if (!dept) {
    const error = new Error('Department record not found.');
    error.statusCode = 404;
    throw error;
  }

  // Check doctors count
  const [docCountResult] = await db.query('SELECT COUNT(*) as count FROM doctors WHERE department_id = ?', [dept.id]);
  const docCount = docCountResult[0].count;

  // Check appointments count
  const [apptCountResult] = await db.query('SELECT COUNT(*) as count FROM appointments WHERE department_id = ?', [dept.id]);
  const apptCount = apptCountResult[0].count;

  if (docCount > 0 || apptCount > 0) {
    if (!fallbackDepartmentId) {
      const error = new Error(
        `Cannot safely delete "${dept.name}". It currently has ${docCount} assigned doctor(s) and ${apptCount} appointment record(s). ` +
        `Please reassign them to another department first or provide a fallback department ID.`
      );
      error.statusCode = 400;
      error.details = { doctorsCount: docCount, appointmentsCount: apptCount, requiresReassignment: true };
      throw error;
    }

    // Verify fallback department exists
    const [fallbackRows] = await db.query('SELECT id, name FROM departments WHERE id = ?', [fallbackDepartmentId]);
    if (fallbackRows.length === 0) {
      const error = new Error('The specified fallback department does not exist.');
      error.statusCode = 400;
      throw error;
    }

    // Transfer doctors and appointments
    await db.query('UPDATE doctors SET department_id = ? WHERE department_id = ?', [fallbackDepartmentId, dept.id]);
    await db.query('UPDATE appointments SET department_id = ? WHERE department_id = ?', [fallbackDepartmentId, dept.id]);
  }

  // Delete the department
  await db.query('DELETE FROM departments WHERE id = ?', [dept.id]);

  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'DELETE_DEPARTMENT', 'DEPARTMENT', ?, ?)`,
      [actorUser.id, dept.id, JSON.stringify({ code: dept.code, name: dept.name, transferredTo: fallbackDepartmentId })]
    ).catch(() => {});
  }

  return {
    success: true,
    message: `Department "${dept.name}" (${dept.code}) has been deleted successfully.`
  };
}

/**
 * Assign Doctor to Department
 */
async function assignDoctorToDepartment(departmentId, doctorId, actorUser = null) {
  const dept = await getDepartmentById(departmentId);
  if (!dept) {
    const error = new Error('Department not found.');
    error.statusCode = 404;
    throw error;
  }

  const [docRows] = await db.query('SELECT id, user_id, doctor_code FROM doctors WHERE id = ?', [doctorId]);
  if (docRows.length === 0) {
    const error = new Error('Doctor not found.');
    error.statusCode = 404;
    throw error;
  }

  await db.query('UPDATE doctors SET department_id = ? WHERE id = ?', [dept.id, doctorId]);

  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'ASSIGN_DOCTOR_DEPARTMENT', 'DEPARTMENT', ?, ?)`,
      [actorUser.id, dept.id, JSON.stringify({ doctorId, doctorCode: docRows[0].doctor_code, departmentCode: dept.code })]
    ).catch(() => {});
  }

  return getDepartmentById(dept.id);
}

/**
 * Get All Doctors in Department
 */
async function getDepartmentDoctors(departmentId) {
  const [doctors] = await db.query(
    `SELECT 
        doc.id,
        doc.doctor_code,
        u.full_name as name,
        u.email,
        u.phone,
        doc.specialization,
        doc.qualification,
        doc.experience_years,
        doc.consultation_fee,
        doc.room_number,
        doc.status,
        doc.is_available
     FROM doctors doc
     JOIN users u ON doc.user_id = u.id
     WHERE doc.department_id = ?
     ORDER BY u.full_name ASC`,
    [departmentId]
  );
  return doctors;
}

/**
 * Aggregated Department Module KPIs
 */
async function getDepartmentStats() {
  const [stats] = await db.query(`
    SELECT 
      COUNT(*) as total_departments,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_departments,
      SUM(CASE WHEN emergency_available = 1 THEN 1 ELSE 0 END) as emergency_units,
      ROUND(AVG(consultation_base_fee), 2) as avg_base_fee
    FROM departments
  `);

  const [docTotal] = await db.query('SELECT COUNT(*) as total FROM doctors WHERE department_id IS NOT NULL');

  return {
    ...(stats[0] || { total_departments: 0, active_departments: 0, emergency_units: 0, avg_base_fee: 0 }),
    total_assigned_doctors: docTotal[0]?.total || 0
  };
}

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  updateDepartmentStatus,
  deleteDepartment,
  assignDoctorToDepartment,
  getDepartmentDoctors,
  getDepartmentStats
};
