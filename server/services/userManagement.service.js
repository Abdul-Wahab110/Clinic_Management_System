const bcrypt = require('bcryptjs');
const db = require('../config/db');
const logger = require('../utils/logger');
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} = require('../utils/errors');

/**
 * List users with dynamic search, multi-field filtering, sorting, and pagination
 */
async function listUsers({ search, role, status, sortBy = 'created_at', sortOrder = 'DESC', page = 1, limit = 10 }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (pageNum - 1) * limitNum;

  const whereClauses = [];
  const params = [];

  if (search && search.trim()) {
    whereClauses.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  if (role) {
    whereClauses.push('r.name = ?');
    params.push(role);
  }

  if (status) {
    whereClauses.push('u.status = ?');
    params.push(status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Safe sorting columns
  const allowedSortColumns = {
    name: 'u.full_name',
    email: 'u.email',
    role: 'r.name',
    status: 'u.status',
    created_at: 'u.created_at',
    last_login: 'u.last_login'
  };

  const sortColumn = allowedSortColumns[sortBy] || 'u.created_at';
  const orderDirection = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Count total records
  const [countRows] = await db.query(
    `SELECT COUNT(*) as total
     FROM users u
     JOIN roles r ON u.role_id = r.id
     ${whereSql}`,
    params
  );
  const total = countRows[0].total;

  // Fetch paginated rows with roles and permissions count
  const [users] = await db.query(
    `SELECT u.id, u.role_id, u.full_name, u.email, u.phone, u.avatar_url, u.status, u.created_at, u.last_login,
            r.name as role_name, r.display_name as role_display_name,
            (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = u.role_id) as permissions_count,
            doc.id as doctor_id, doc.specialization,
            pat.id as patient_id, pat.patient_code
     FROM users u
     JOIN roles r ON u.role_id = r.id
     LEFT JOIN doctors doc ON doc.user_id = u.id
     LEFT JOIN patients pat ON pat.user_id = u.id
     ${whereSql}
     ORDER BY ${sortColumn} ${orderDirection}
     LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return { users, total, page: pageNum, limit: limitNum };
}

/**
 * Get detailed user profile by ID (including permissions, linked clinical records, and recent audit activity)
 */
async function getUserDetails(userId) {
  const [users] = await db.query(
    `SELECT u.id, u.role_id, u.full_name, u.email, u.phone, u.avatar_url, u.status, u.email_verified, u.created_at, u.updated_at, u.last_login,
            r.name as role_name, r.display_name as role_display_name, r.description as role_description, r.is_system as role_is_system,
            doc.id as doctor_id, doc.specialization, doc.qualification, doc.experience_years, doc.consultation_fee, doc.room_number,
            dept.name as department_name,
            pat.id as patient_id, pat.patient_code, pat.gender as patient_gender, pat.date_of_birth as patient_dob, pat.blood_group as patient_blood_group, pat.address as patient_address
     FROM users u
     JOIN roles r ON u.role_id = r.id
     LEFT JOIN doctors doc ON doc.user_id = u.id
     LEFT JOIN departments dept ON doc.department_id = dept.id
     LEFT JOIN patients pat ON pat.user_id = u.id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );

  if (users.length === 0) {
    throw new NotFoundError('User account not found.');
  }

  const user = users[0];

  // Fetch all granted permissions
  const [perms] = await db.query(
    `SELECT p.id, p.code, p.module, p.description
     FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     WHERE rp.role_id = ?
     ORDER BY p.module ASC, p.code ASC`,
    [user.role_id]
  );

  // Fetch recent audit activity
  const [auditLogs] = await db.query(
    `SELECT id, action, entity, entity_id, ip_address, created_at, details_json
     FROM audit_logs
     WHERE user_id = ?
     ORDER BY id DESC
     LIMIT 10`,
    [user.id]
  );

  return {
    id: user.id,
    roleId: user.role_id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatar_url,
    status: user.status,
    emailVerified: Boolean(user.email_verified),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    lastLogin: user.last_login,
    role: {
      id: user.role_id,
      name: user.role_name,
      displayName: user.role_display_name,
      description: user.role_description,
      isSystem: Boolean(user.role_is_system)
    },
    doctor: user.doctor_id ? {
      id: user.doctor_id,
      department: user.department_name,
      specialization: user.specialization,
      qualification: user.qualification,
      experienceYears: user.experience_years,
      consultationFee: user.consultation_fee,
      roomNumber: user.room_number
    } : null,
    patient: user.patient_id ? {
      id: user.patient_id,
      patientCode: user.patient_code,
      gender: user.patient_gender,
      dateOfBirth: user.patient_dob,
      bloodGroup: user.patient_blood_group,
      address: user.patient_address
    } : null,
    permissions: perms,
    recentActivity: auditLogs
  };
}

/**
 * Admin: Create a new user with role assignment and validation
 */
async function createUser(data, actorUser, ip = null, userAgent = null) {
  const cleanEmail = data.email.trim().toLowerCase();

  // Check email uniqueness
  const [existing] = await db.query('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [cleanEmail]);
  if (existing.length > 0) {
    throw new ConflictError(`An account with email "${cleanEmail}" already exists.`);
  }

  // Validate role exists
  const [roles] = await db.query('SELECT id, name, display_name FROM roles WHERE id = ?', [data.role_id]);
  if (roles.length === 0) {
    throw new NotFoundError('Selected role does not exist.');
  }
  const role = roles[0];

  // Hierarchy check: Only super_admin can create super_admin
  if (role.name === 'super_admin' && actorUser.role !== 'super_admin') {
    throw new ForbiddenError('Only Super Administrators can create Super Admin accounts.');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(data.password || 'Clinic2026!', salt);

  const [result] = await db.query(
    `INSERT INTO users (role_id, full_name, email, password_hash, phone, status, email_verified)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [
      data.role_id,
      data.full_name.trim(),
      cleanEmail,
      passwordHash,
      data.phone ? data.phone.trim() : null,
      data.status || 'active'
    ]
  );

  const newUserId = result.insertId;

  await logger.audit(actorUser.id, 'ADMIN_CREATED_USER', 'users', newUserId, ip, userAgent, {
    fullName: data.full_name,
    email: cleanEmail,
    roleId: data.role_id,
    roleName: role.name,
    status: data.status || 'active'
  });

  return await getUserDetails(newUserId);
}

/**
 * Admin: Update user details (Name, Email, Phone, Role, Status)
 */
async function updateUser(userId, data, actorUser, ip = null, userAgent = null) {
  const [targetUsers] = await db.query(
    `SELECT u.id, u.role_id, u.email, u.status, r.name as role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [userId]
  );

  if (targetUsers.length === 0) {
    throw new NotFoundError('User account not found.');
  }

  const target = targetUsers[0];

  // Hierarchy check
  if (target.role_name === 'super_admin' && actorUser.role !== 'super_admin') {
    throw new ForbiddenError('Only Super Administrators can modify Super Admin accounts.');
  }

  const updates = [];
  const params = [];

  if (data.full_name) {
    updates.push('full_name = ?');
    params.push(data.full_name.trim());
  }

  if (data.email) {
    const cleanEmail = data.email.trim().toLowerCase();
    if (cleanEmail !== target.email.toLowerCase()) {
      const [existing] = await db.query('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', [cleanEmail, userId]);
      if (existing.length > 0) {
        throw new ConflictError(`Email "${cleanEmail}" is already in use by another account.`);
      }
      updates.push('email = ?');
      params.push(cleanEmail);
    }
  }

  if (data.phone !== undefined) {
    updates.push('phone = ?');
    params.push(data.phone ? data.phone.trim() : null);
  }

  if (data.role_id && parseInt(data.role_id, 10) !== target.role_id) {
    const [roles] = await db.query('SELECT id, name FROM roles WHERE id = ?', [data.role_id]);
    if (roles.length === 0) throw new NotFoundError('Selected role does not exist.');
    if (roles[0].name === 'super_admin' && actorUser.role !== 'super_admin') {
      throw new ForbiddenError('Only Super Administrators can assign the Super Admin role.');
    }
    updates.push('role_id = ?');
    params.push(data.role_id);
  }

  if (data.status && data.status !== target.status) {
    if (parseInt(userId, 10) === parseInt(actorUser.id, 10)) {
      throw new BadRequestError('You cannot change the status of your own account.');
    }
    updates.push('status = ?');
    params.push(data.status);
  }

  if (updates.length > 0) {
    params.push(userId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  await logger.audit(actorUser.id, 'ADMIN_UPDATED_USER', 'users', userId, ip, userAgent, {
    updatedFields: Object.keys(data)
  });

  return await getUserDetails(userId);
}

/**
 * Admin: Change Role
 */
async function changeUserRole(userId, newRoleId, actorUser, ip = null, userAgent = null) {
  return await updateUser(userId, { role_id: newRoleId }, actorUser, ip, userAgent);
}

/**
 * Admin: Toggle Status
 */
async function toggleUserStatus(userId, status, actorUser, ip = null, userAgent = null) {
  return await updateUser(userId, { status }, actorUser, ip, userAgent);
}

/**
 * Admin: Reset User Password
 */
async function adminResetPassword(userId, newPassword, actorUser, ip = null, userAgent = null) {
  const [users] = await db.query('SELECT id, email, role_id FROM users WHERE id = ?', [userId]);
  if (users.length === 0) throw new NotFoundError('User not found.');

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  await db.withTransaction(async (conn) => {
    await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
    await conn.query('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0', [userId]);
  });

  await logger.audit(actorUser.id, 'ADMIN_RESET_PASSWORD', 'users', userId, ip, userAgent, { targetUserId: userId });

  return { message: 'Password has been successfully updated.' };
}

/**
 * Admin: Delete or Deactivate User
 */
async function deleteUser(userId, actorUser, ip = null, userAgent = null) {
  if (parseInt(userId, 10) === parseInt(actorUser.id, 10)) {
    throw new BadRequestError('You cannot delete your own logged-in administrator account.');
  }

  const [users] = await db.query(
    `SELECT u.id, r.name as role_name 
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [userId]
  );

  if (users.length === 0) {
    throw new NotFoundError('User not found.');
  }

  if (users[0].role_name === 'super_admin') {
    const [superAdmins] = await db.query('SELECT COUNT(*) as count FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = "super_admin" AND u.status = "active"');
    if (superAdmins[0].count <= 1) {
      throw new ForbiddenError('Cannot delete the last active Super Administrator account.');
    }
  }

  // Check if user has dependent medical records/appointments/invoices
  try {
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    await logger.audit(actorUser.id, 'ADMIN_DELETED_USER_RECORD', 'users', userId, ip, userAgent, { deletedId: userId });
    return { message: `User #${userId} and associated credentials deleted permanently.`, mode: 'deleted' };
  } catch (fkErr) {
    // If foreign key constraint prevents hard delete, soft-deactivate the account safely
    await db.query('UPDATE users SET status = "inactive" WHERE id = ?', [userId]);
    await logger.audit(actorUser.id, 'ADMIN_DEACTIVATED_USER_DEPENDENT', 'users', userId, ip, userAgent, { deactivatedId: userId });
    return { message: `User #${userId} has clinical records in system; account has been deactivated.`, mode: 'deactivated' };
  }
}

module.exports = {
  listUsers,
  getUserDetails,
  createUser,
  updateUser,
  changeUserRole,
  toggleUserStatus,
  adminResetPassword,
  deleteUser
};
