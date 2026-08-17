const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');

const roleMapping = {
  doctor: 3,
  nurse: 5,
  receptionist: 4,
  lab_technician: 6,
  pharmacist: 7,
  accountant: 8,
  admin: 2,
  other: 4
};

/**
 * List Hospital Staff Directory with Multi-Criteria Filtering
 */
async function listStaff(query = {}) {
  const { staff_type, department_id, status, search, page = 1, limit = 50 } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  if (staff_type && staff_type !== 'all') {
    conditions.push('sp.staff_type = ?');
    params.push(staff_type);
  }

  if (department_id && department_id !== 'all') {
    conditions.push('sp.department_id = ?');
    params.push(parseInt(department_id, 10));
  }

  if (status && status !== 'all') {
    conditions.push('sp.status = ?');
    params.push(status);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(sp.employee_id LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR sp.designation LIKE ?)');
    params.push(term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total
     FROM staff_profiles sp
     JOIN users u ON sp.user_id = u.id
     LEFT JOIN departments d ON sp.department_id = d.id
     ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await db.query(
    `SELECT 
      sp.*,
      u.full_name,
      u.email,
      u.phone,
      u.status as user_auth_status,
      u.last_login,
      r.name as role_name,
      r.display_name as role_display_name,
      d.name as department_name,
      d.code as department_code,
      doc.doctor_code,
      doc.specialization as doctor_specialization
    FROM staff_profiles sp
    JOIN users u ON sp.user_id = u.id
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN departments d ON sp.department_id = d.id
    LEFT JOIN doctors doc ON doc.user_id = u.id
    ${whereClause}
    ORDER BY sp.status = 'active' DESC, sp.joining_date DESC, sp.id DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    staff: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Get Comprehensive Staff Profile
 */
async function getStaffById(id) {
  const [rows] = await db.query(
    `SELECT 
      sp.*,
      u.full_name,
      u.email,
      u.phone,
      u.status as user_auth_status,
      u.last_login,
      u.created_at as user_created_at,
      r.name as role_name,
      r.display_name as role_display_name,
      d.name as department_name,
      d.code as department_code,
      d.floor_location,
      doc.id as doctor_id,
      doc.doctor_code,
      doc.specialization,
      doc.qualification as doctor_qualification,
      doc.consultation_fee
    FROM staff_profiles sp
    JOIN users u ON sp.user_id = u.id
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN departments d ON sp.department_id = d.id
    LEFT JOIN doctors doc ON doc.user_id = u.id
    WHERE sp.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Staff member not found.');
  return rows[0];
}

/**
 * Add New Staff Member (Provisions in Users & Staff Profiles)
 */
async function addStaff(data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const email = data.email.trim().toLowerCase();
    const [existingUser] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      throw new ConflictError(`User account with email '${email}' is already registered.`);
    }

    const staffType = data.staff_type || 'other';
    const roleId = roleMapping[staffType] || 4; // Default to receptionist/staff
    const plainPassword = data.password && data.password.trim().length >= 6 ? data.password.trim() : 'AuraCareStaff2026!';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // 1. Provision User Account in `users`
    const [userRes] = await connection.query(
      `INSERT INTO users 
       (role_id, full_name, email, password_hash, phone, status, email_verified)
       VALUES (?, ?, ?, ?, ?, 'active', 1)`,
      [
        roleId,
        data.full_name.trim(),
        email,
        passwordHash,
        data.phone ? data.phone.trim() : null
      ]
    );

    const userId = userRes.insertId;

    // 2. Generate Unique Employee ID
    const employeeId = data.employee_id && data.employee_id.trim().length > 0
      ? data.employee_id.trim()
      : `EMP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const departmentId = data.department_id ? parseInt(data.department_id, 10) : 1;
    const joiningDate = data.joining_date || new Date().toISOString().slice(0, 10);

    // 3. Insert into `staff_profiles`
    const [staffRes] = await connection.query(
      `INSERT INTO staff_profiles 
       (user_id, employee_id, department_id, designation, staff_type, joining_date, qualification, emergency_contact, emergency_phone, salary_monthly, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        employeeId,
        departmentId,
        data.designation.trim(),
        staffType,
        joiningDate,
        data.qualification ? data.qualification.trim() : null,
        data.emergency_contact ? data.emergency_contact.trim() : null,
        data.emergency_phone ? data.emergency_phone.trim() : null,
        data.salary_monthly ? parseFloat(data.salary_monthly) : null,
        data.status || 'active',
        data.notes ? data.notes.trim() : null
      ]
    );

    const staffId = staffRes.insertId;

    // 4. If Doctor, also provision in `doctors` table
    if (staffType === 'doctor') {
      const doctorCode = `DOC-${new Date().getFullYear()}-${String(userId).padStart(4, '0')}`;
      await connection.query(
        `INSERT INTO doctors 
         (user_id, doctor_code, department_id, specialization, qualification, experience_years, consultation_fee, is_available, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active')`,
        [
          userId,
          doctorCode,
          departmentId,
          data.designation.trim(),
          data.qualification ? data.qualification.trim() : 'MD, Board Certified Physician',
          data.experience_years ? parseInt(data.experience_years, 10) : 5,
          data.consultation_fee ? parseFloat(data.consultation_fee) : 150.00
        ]
      );
    }

    await connection.commit();

    return {
      id: staffId,
      user_id: userId,
      employee_id: employeeId,
      full_name: data.full_name,
      email,
      staff_type: staffType,
      designation: data.designation,
      message: `Hospital staff member ${data.full_name} (${employeeId}) onboarded successfully.`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Edit Staff Profile & Linked User Account
 */
async function updateStaff(id, data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [existing] = await connection.query('SELECT * FROM staff_profiles WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0) throw new NotFoundError('Staff profile not found.');
    const cur = existing[0];

    // Update `users` table if name, email, phone changed
    if (data.full_name || data.email || data.phone) {
      const [uRows] = await connection.query('SELECT * FROM users WHERE id = ?', [cur.user_id]);
      if (uRows.length > 0) {
        const u = uRows[0];
        const newEmail = data.email ? data.email.trim().toLowerCase() : u.email;

        // Check if email already used by another user
        if (newEmail !== u.email) {
          const [conflict] = await connection.query('SELECT id FROM users WHERE email = ? AND id != ?', [newEmail, cur.user_id]);
          if (conflict.length > 0) throw new ConflictError(`Email '${newEmail}' is already in use by another user.`);
        }

        await connection.query(
          `UPDATE users 
           SET full_name = ?, email = ?, phone = ? 
           WHERE id = ?`,
          [
            data.full_name ? data.full_name.trim() : u.full_name,
            newEmail,
            data.phone !== undefined ? data.phone : u.phone,
            cur.user_id
          ]
        );
      }
    }

    const newDeptId = data.department_id !== undefined ? parseInt(data.department_id, 10) : cur.department_id;
    const newDesignation = data.designation !== undefined ? data.designation.trim() : cur.designation;
    const newStatus = data.status || cur.status;

    // Update `staff_profiles`
    await connection.query(
      `UPDATE staff_profiles 
       SET department_id = ?,
           designation = ?,
           staff_type = ?,
           joining_date = ?,
           qualification = ?,
           emergency_contact = ?,
           emergency_phone = ?,
           salary_monthly = ?,
           status = ?,
           notes = ?
       WHERE id = ?`,
      [
        newDeptId,
        newDesignation,
        data.staff_type || cur.staff_type,
        data.joining_date || cur.joining_date,
        data.qualification !== undefined ? data.qualification : cur.qualification,
        data.emergency_contact !== undefined ? data.emergency_contact : cur.emergency_contact,
        data.emergency_phone !== undefined ? data.emergency_phone : cur.emergency_phone,
        data.salary_monthly !== undefined ? parseFloat(data.salary_monthly) : cur.salary_monthly,
        newStatus,
        data.notes !== undefined ? data.notes : cur.notes,
        id
      ]
    );

    // Synchronize users.status if status changed
    await connection.query(
      "UPDATE users SET status = ? WHERE id = ?",
      [newStatus === 'inactive' ? 'inactive' : 'active', cur.user_id]
    );

    // If doctor, also synchronize doctor specialization & department
    if (cur.staff_type === 'doctor') {
      await connection.query(
        "UPDATE doctors SET department_id = ?, specialization = ?, status = ? WHERE user_id = ?",
        [newDeptId, newDesignation, newStatus === 'inactive' ? 'inactive' : 'active', cur.user_id]
      );
    }

    await connection.commit();

    return { id, message: 'Staff profile updated successfully.' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Activate / Deactivate / Set Staff Status
 */
async function updateStaffStatus(id, status, actorUser) {
  const [existing] = await db.query('SELECT user_id, staff_type FROM staff_profiles WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Staff member not found.');
  const { user_id, staff_type } = existing[0];

  await db.query('UPDATE staff_profiles SET status = ? WHERE id = ?', [status, id]);
  await db.query('UPDATE users SET status = ? WHERE id = ?', [status === 'inactive' ? 'inactive' : 'active', user_id]);

  if (staff_type === 'doctor') {
    await db.query('UPDATE doctors SET status = ? WHERE user_id = ?', [status === 'inactive' ? 'inactive' : 'active', user_id]);
  }

  return { id, status, message: `Staff status updated to ${status.toUpperCase()}.` };
}

/**
 * Department Assignment / Transfer
 */
async function assignDepartment(id, department_id, actorUser) {
  const deptId = parseInt(department_id, 10);
  const [deptRows] = await db.query('SELECT name FROM departments WHERE id = ?', [deptId]);
  if (deptRows.length === 0) throw new NotFoundError('Department not found.');

  const [existing] = await db.query('SELECT user_id, staff_type FROM staff_profiles WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Staff member not found.');
  const { user_id, staff_type } = existing[0];

  await db.query('UPDATE staff_profiles SET department_id = ? WHERE id = ?', [deptId, id]);

  if (staff_type === 'doctor') {
    await db.query('UPDATE doctors SET department_id = ? WHERE user_id = ?', [deptId, user_id]);
  }

  return { id, department_id: deptId, department_name: deptRows[0].name, message: `Assigned to ${deptRows[0].name} department.` };
}

/**
 * Hospital Staff Aggregate Statistics & KPIs
 */
async function getStaffStats() {
  const [typeStats] = await db.query(`
    SELECT 
      COUNT(*) as total_staff,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_staff,
      SUM(CASE WHEN status = 'on_leave' THEN 1 ELSE 0 END) as on_leave_staff,
      SUM(CASE WHEN staff_type = 'doctor' THEN 1 ELSE 0 END) as doctors_count,
      SUM(CASE WHEN staff_type = 'nurse' THEN 1 ELSE 0 END) as nurses_count,
      SUM(CASE WHEN staff_type = 'pharmacist' THEN 1 ELSE 0 END) as pharmacists_count,
      SUM(CASE WHEN staff_type = 'lab_technician' THEN 1 ELSE 0 END) as lab_techs_count,
      SUM(CASE WHEN staff_type = 'accountant' THEN 1 ELSE 0 END) as accountants_count,
      SUM(CASE WHEN staff_type = 'receptionist' THEN 1 ELSE 0 END) as receptionists_count
    FROM staff_profiles
  `);

  const [deptBreakdown] = await db.query(`
    SELECT 
      d.name as department_name,
      COUNT(sp.id) as staff_count
    FROM staff_profiles sp
    JOIN departments d ON sp.department_id = d.id
    GROUP BY d.name
    ORDER BY staff_count DESC
  `);

  return {
    ...typeStats[0],
    departments_breakdown: deptBreakdown
  };
}

module.exports = {
  listStaff,
  getStaffById,
  addStaff,
  updateStaff,
  updateStaffStatus,
  assignDepartment,
  getStaffStats
};
