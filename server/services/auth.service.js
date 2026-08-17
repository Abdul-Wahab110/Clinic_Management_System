const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const config = require('../config/env');
const logger = require('../utils/logger');
const {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} = require('../utils/errors');

/**
 * Generate JWT token payload
 */
function generateTokens(user) {
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role_name
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return { token, expiresIn: config.jwt.expiresIn };
}

/**
 * Self-registration for Patients
 */
async function registerPatient(data, ip = null, userAgent = null) {
  return await db.withTransaction(async (conn) => {
    // 1. Check if email already registered
    const [existingUsers] = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [data.email.trim().toLowerCase()]);
    if (existingUsers.length > 0) {
      throw new ConflictError('An account with this email address is already registered.');
    }

    // 2. Fetch patient role ID
    const [roles] = await conn.query("SELECT id FROM roles WHERE name = 'patient' LIMIT 1");
    if (roles.length === 0) {
      throw new NotFoundError("Default 'patient' role not found in system.");
    }
    const patientRoleId = roles[0].id;

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    // 4. Create user record
    const cleanedPhone = data.phone ? data.phone.trim() : null;
    const [userResult] = await conn.query(
      `INSERT INTO users (role_id, full_name, email, password_hash, phone, status, email_verified)
       VALUES (?, ?, ?, ?, ?, 'active', 1)`,
      [patientRoleId, data.full_name.trim(), data.email.trim().toLowerCase(), passwordHash, cleanedPhone]
    );
    const userId = userResult.insertId;

    // 5. Generate unique patient code (PAT-YEAR-XXXX)
    const patientCode = `PAT-${new Date().getFullYear()}-${String(userId).padStart(4, '0')}`;

    // Split name properly (handles single name like "Zarnab")
    const nameParts = data.full_name.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Patient';
    const lastName = nameParts.slice(1).join(' ') || nameParts[0] || 'User';

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

    // 6. Create patient record
    const [patientResult] = await conn.query(
      `INSERT INTO patients (user_id, patient_code, first_name, last_name, gender, date_of_birth, blood_group, phone, email, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        patientCode,
        firstName,
        lastName,
        normalizedGender,
        normalizedDob,
        normalizedBloodGroup,
        cleanedPhone || '',
        data.email.trim().toLowerCase(),
        data.address ? data.address.trim() : null
      ]
    );

    // 7. Audit Log
    await logger.audit(userId, 'USER_REGISTERED_PATIENT', 'users', userId, ip, userAgent, {
      email: data.email,
      patientCode
    }, conn);

    const userObj = {
      id: userId,
      fullName: data.full_name.trim(),
      email: data.email.trim().toLowerCase(),
      role: 'patient',
      roleDisplayName: 'Patient',
      patientId: patientResult.insertId,
      patientCode
    };

    const { token, expiresIn } = generateTokens({ id: userId, email: data.email, role_name: 'patient' });

    return { user: userObj, token, expiresIn };
  });
}

/**
 * User Login
 */
async function login(email, password, ip = null, userAgent = null) {
  const cleanEmail = email.trim().toLowerCase();

  const [users] = await db.query(
    `SELECT u.id, u.role_id, u.full_name, u.email, u.password_hash, u.phone, u.avatar_url, u.status,
            r.name as role_name, r.display_name as role_display_name,
            p.id as patient_id, p.patient_code,
            d.id as doctor_id, d.specialization
     FROM users u
     JOIN roles r ON u.role_id = r.id
     LEFT JOIN patients p ON p.user_id = u.id
     LEFT JOIN doctors d ON d.user_id = u.id
     WHERE LOWER(u.email) = ? LIMIT 1`,
    [cleanEmail]
  );

  if (users.length === 0) {
    await logger.audit(null, 'LOGIN_FAILED_UNKNOWN_EMAIL', 'users', null, ip, userAgent, { email: cleanEmail });
    throw new UnauthorizedError('Invalid email or password.');
  }

  const user = users[0];

  // Verify password
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    await logger.audit(user.id, 'LOGIN_FAILED_INVALID_PASSWORD', 'users', user.id, ip, userAgent, { email: cleanEmail });
    throw new UnauthorizedError('Invalid email or password.');
  }

  // Check user status
  if (user.status !== 'active') {
    await logger.audit(user.id, 'LOGIN_BLOCKED_STATUS', 'users', user.id, ip, userAgent, { status: user.status });
    throw new ForbiddenError(`Your account is currently ${user.status}. Please contact the clinic administrator.`);
  }

  // Update last login timestamp
  await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

  // Fetch permissions
  const [perms] = await db.query(
    `SELECT p.code 
     FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     WHERE rp.role_id = ?`,
    [user.role_id]
  );
  const permissions = perms.map((p) => p.code);

  // Generate tokens
  const { token, expiresIn } = generateTokens(user);

  await logger.audit(user.id, 'USER_LOGIN_SUCCESS', 'users', user.id, ip, userAgent, {
    role: user.role_name
  });

  return {
    user: {
      id: user.id,
      roleId: user.role_id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      role: user.role_name,
      roleDisplayName: user.role_display_name,
      patientId: user.patient_id || null,
      patientCode: user.patient_code || null,
      doctorId: user.doctor_id || null,
      specialization: user.specialization || null,
      permissions
    },
    token,
    expiresIn
  };
}

/**
 * Get User Profile by ID
 */
async function getProfile(userId) {
  const [users] = await db.query(
    `SELECT u.id, u.role_id, u.full_name, u.email, u.phone, u.avatar_url, u.status, u.created_at, u.last_login,
            r.name as role_name, r.display_name as role_display_name,
            p.id as patient_id, p.patient_code, p.gender, p.date_of_birth, p.blood_group, p.address,
            d.id as doctor_id, d.specialization, d.qualification, d.experience_years, d.consultation_fee, d.bio, d.room_number,
            dept.name as department_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     LEFT JOIN patients p ON p.user_id = u.id
     LEFT JOIN doctors d ON d.user_id = u.id
     LEFT JOIN departments dept ON d.department_id = dept.id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );

  if (users.length === 0) {
    throw new NotFoundError('User profile not found.');
  }

  const user = users[0];

  const [perms] = await db.query(
    `SELECT p.code 
     FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     WHERE rp.role_id = ?`,
    [user.role_id]
  );
  const permissions = perms.map((p) => p.code);

  return {
    id: user.id,
    roleId: user.role_id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatar_url,
    status: user.status,
    role: user.role_name,
    roleDisplayName: user.role_display_name,
    createdAt: user.created_at,
    lastLogin: user.last_login,
    patient: user.patient_id ? {
      id: user.patient_id,
      patientCode: user.patient_code,
      gender: user.gender,
      dateOfBirth: user.date_of_birth,
      bloodGroup: user.blood_group,
      address: user.address
    } : null,
    doctor: user.doctor_id ? {
      id: user.doctor_id,
      department: user.department_name,
      specialization: user.specialization,
      qualification: user.qualification,
      experienceYears: user.experience_years,
      consultationFee: user.consultation_fee,
      bio: user.bio,
      roomNumber: user.room_number
    } : null,
    permissions
  };
}

/**
 * Update Profile
 */
async function updateProfile(userId, data, ip = null, userAgent = null) {
  const [users] = await db.query('SELECT id, email, full_name, phone, role_id FROM users WHERE id = ?', [userId]);
  if (users.length === 0) {
    throw new NotFoundError('User not found.');
  }

  const updates = [];
  const params = [];

  if (data.full_name) {
    updates.push('full_name = ?');
    params.push(data.full_name.trim());
  }
  if (data.phone !== undefined) {
    updates.push('phone = ?');
    params.push(data.phone ? data.phone.trim() : null);
  }
  if (data.avatar_url !== undefined) {
    updates.push('avatar_url = ?');
    params.push(data.avatar_url);
  }

  if (updates.length > 0) {
    params.push(userId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  // Handle Patient-specific fields
  const [patRows] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [userId]);
  if (patRows.length > 0) {
    const patId = patRows[0].id;
    const patUpdates = [];
    const patParams = [];

    if (data.full_name) {
      const parts = data.full_name.trim().split(/\s+/);
      const fName = parts[0] || 'Patient';
      const lName = parts.slice(1).join(' ') || '.';
      patUpdates.push('first_name = ?', 'last_name = ?');
      patParams.push(fName, lName);
    }
    if (data.phone !== undefined) {
      patUpdates.push('phone = ?');
      patParams.push(data.phone ? data.phone.trim() : null);
    }
    if (data.gender) {
      patUpdates.push('gender = ?');
      patParams.push(data.gender.toLowerCase());
    }
    if (data.date_of_birth) {
      patUpdates.push('date_of_birth = ?');
      patParams.push(data.date_of_birth);
    }
    if (data.blood_group) {
      patUpdates.push('blood_group = ?');
      patParams.push(data.blood_group);
    }
    if (data.address !== undefined) {
      patUpdates.push('address = ?');
      patParams.push(data.address ? data.address.trim() : null);
    }
    if (data.emergency_contact_name !== undefined) {
      patUpdates.push('emergency_contact_name = ?');
      patParams.push(data.emergency_contact_name ? data.emergency_contact_name.trim() : null);
    }
    if (data.emergency_contact_phone !== undefined) {
      patUpdates.push('emergency_contact_phone = ?');
      patParams.push(data.emergency_contact_phone ? data.emergency_contact_phone.trim() : null);
    }

    if (patUpdates.length > 0) {
      patParams.push(patId);
      await db.query(`UPDATE patients SET ${patUpdates.join(', ')} WHERE id = ?`, patParams);
    }
  }

  // Handle Doctor-specific fields
  const [docRows] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [userId]);
  if (docRows.length > 0) {
    const docId = docRows[0].id;
    const docUpdates = [];
    const docParams = [];

    if (data.bio !== undefined) {
      docUpdates.push('bio = ?');
      docParams.push(data.bio ? data.bio.trim() : null);
    }
    if (data.specialization) {
      docUpdates.push('specialization = ?');
      docParams.push(data.specialization.trim());
    }
    if (data.qualification) {
      docUpdates.push('qualification = ?');
      docParams.push(data.qualification.trim());
    }
    if (data.room_number !== undefined) {
      docUpdates.push('room_number = ?');
      docParams.push(data.room_number ? data.room_number.trim() : null);
    }
    if (data.experience_years !== undefined) {
      docUpdates.push('experience_years = ?');
      docParams.push(parseInt(data.experience_years, 10) || 0);
    }
    if (data.consultation_fee !== undefined) {
      docUpdates.push('consultation_fee = ?');
      docParams.push(parseFloat(data.consultation_fee) || 0);
    }

    if (docUpdates.length > 0) {
      docParams.push(docId);
      await db.query(`UPDATE doctors SET ${docUpdates.join(', ')} WHERE id = ?`, docParams);
    }
  }

  // Handle Staff profiles
  const [staffRows] = await db.query('SELECT id FROM staff_profiles WHERE user_id = ? LIMIT 1', [userId]);
  if (staffRows.length > 0) {
    const staffId = staffRows[0].id;
    const staffUpdates = [];
    const staffParams = [];

    if (data.address !== undefined) {
      staffUpdates.push('address = ?');
      staffParams.push(data.address ? data.address.trim() : null);
    }
    if (data.emergency_contact_phone !== undefined) {
      staffUpdates.push('emergency_contact_phone = ?');
      staffParams.push(data.emergency_contact_phone ? data.emergency_contact_phone.trim() : null);
    }
    if (data.qualification !== undefined) {
      staffUpdates.push('qualification = ?');
      staffParams.push(data.qualification ? data.qualification.trim() : null);
    }

    if (staffUpdates.length > 0) {
      staffParams.push(staffId);
      await db.query(`UPDATE staff_profiles SET ${staffUpdates.join(', ')} WHERE id = ?`, staffParams);
    }
  }

  await logger.audit(userId, 'USER_UPDATED_PROFILE', 'users', userId, ip, userAgent, { updates: Object.keys(data) });

  return await getProfile(userId);
}

/**
 * Change Password
 */
async function changePassword(userId, currentPassword, newPassword, ip = null, userAgent = null) {
  const [users] = await db.query('SELECT id, password_hash FROM users WHERE id = ?', [userId]);
  if (users.length === 0) {
    throw new NotFoundError('User not found.');
  }

  const user = users[0];
  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    throw new BadRequestError('Current password entered is incorrect.');
  }

  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(newPassword, salt);

  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

  await logger.audit(userId, 'PASSWORD_CHANGED', 'users', userId, ip, userAgent, { success: true });

  return { message: 'Password updated successfully.' };
}

/**
 * Forgot Password - Generate Reset Token
 */
async function forgotPassword(email, ip = null, userAgent = null) {
  const cleanEmail = email.trim().toLowerCase();
  const [users] = await db.query('SELECT id, email, full_name FROM users WHERE LOWER(email) = ?', [cleanEmail]);

  if (users.length === 0) {
    // For security, don't reveal if user exists
    return { message: 'If an account matches that email, a password reset link/token has been generated.' };
  }

  const user = users[0];
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Invalidate any older unused tokens
  await db.query('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0', [user.id]);

  await db.query(
    'INSERT INTO password_resets (user_id, token_hash, expires_at, used) VALUES (?, ?, ?, 0)',
    [user.id, tokenHash, expiresAt]
  );

  await logger.audit(user.id, 'PASSWORD_RESET_REQUESTED', 'password_resets', null, ip, userAgent, { email: cleanEmail });

  return {
    message: 'If an account matches that email, a password reset link/token has been generated.',
    // Return rawToken for demonstration / local testing in non-email environment
    demoResetToken: rawToken
  };
}

/**
 * Reset Password with Token
 */
async function resetPassword(rawToken, newPassword, ip = null, userAgent = null) {
  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

  const [resets] = await db.query(
    `SELECT id, user_id, expires_at, used
     FROM password_resets
     WHERE token_hash = ? AND used = 0 AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  );

  if (resets.length === 0) {
    throw new BadRequestError('Invalid or expired password reset token.');
  }

  const reset = resets[0];
  const salt = await bcrypt.genSalt(10);
  const newHash = await bcrypt.hash(newPassword, salt);

  await db.withTransaction(async (conn) => {
    await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, reset.user_id]);
    await conn.query('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);
  });

  await logger.audit(reset.user_id, 'PASSWORD_RESET_SUCCESS', 'users', reset.user_id, ip, userAgent, { resetId: reset.id });

  return { message: 'Password has been reset successfully. You can now login with your new password.' };
}

/**
 * Admin: List All Users with Filtering and Pagination
 */
async function getUsersList(filters = {}, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const params = [];

  if (filters.role) {
    whereClauses.push('r.name = ?');
    params.push(filters.role);
  }
  if (filters.status) {
    whereClauses.push('u.status = ?');
    params.push(filters.status);
  }
  if (filters.search) {
    whereClauses.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total
     FROM users u
     JOIN roles r ON u.role_id = r.id
     ${whereSql}`,
    params
  );

  const total = countRows[0].total;

  const [users] = await db.query(
    `SELECT u.id, u.role_id, u.full_name, u.email, u.phone, u.status, u.last_login, u.created_at,
            r.name as role_name, r.display_name as role_display_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit, 10), parseInt(offset, 10)]
  );

  return { users, total };
}

/**
 * Admin: Toggle User Status (active, inactive, suspended)
 */
async function toggleUserStatus(targetUserId, status, actorUser, ip = null, userAgent = null) {
  if (parseInt(targetUserId, 10) === parseInt(actorUser.id, 10)) {
    throw new BadRequestError('You cannot change the status of your own account.');
  }

  const [targetUsers] = await db.query(
    `SELECT u.id, u.role_id, r.name as role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [targetUserId]
  );

  if (targetUsers.length === 0) {
    throw new NotFoundError('Target user not found.');
  }

  const target = targetUsers[0];

  // Prevent hospital admin from modifying super admin
  if (target.role_name === 'super_admin' && actorUser.role !== 'super_admin') {
    throw new ForbiddenError('Only Super Administrators can modify Super Admin accounts.');
  }

  await db.query('UPDATE users SET status = ? WHERE id = ?', [status, targetUserId]);

  await logger.audit(actorUser.id, 'ADMIN_UPDATED_USER_STATUS', 'users', targetUserId, ip, userAgent, {
    newStatus: status
  });

  return { message: `User status successfully updated to ${status}.`, userId: targetUserId, status };
}

/**
 * Admin: Create Staff / User Account
 */
async function createUserByAdmin(userData, actorUser, ip = null, userAgent = null) {
  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [userData.email.trim()]);
  if (existing.length > 0) {
    throw new ConflictError('A user with this email address already exists.');
  }

  const [roles] = await db.query('SELECT id, name FROM roles WHERE id = ?', [userData.role_id]);
  if (roles.length === 0) {
    throw new NotFoundError('Selected role does not exist.');
  }
  const role = roles[0];

  // Only super admin can create another super admin
  if (role.name === 'super_admin' && actorUser.role !== 'super_admin') {
    throw new ForbiddenError('Only Super Administrators can create Super Admin accounts.');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(userData.password, salt);

  const [result] = await db.query(
    `INSERT INTO users (role_id, full_name, email, password_hash, phone, status, email_verified)
     VALUES (?, ?, ?, ?, ?, 'active', 1)`,
    [userData.role_id, userData.full_name.trim(), userData.email.trim(), passwordHash, userData.phone ? userData.phone.trim() : null]
  );

  const newUserId = result.insertId;

  await logger.audit(actorUser.id, 'ADMIN_CREATED_USER', 'users', newUserId, ip, userAgent, {
    email: userData.email,
    roleId: userData.role_id,
    roleName: role.name
  });

  return { id: newUserId, fullName: userData.full_name, email: userData.email, role: role.name };
}

/**
 * Get All System Roles
 */
async function getRoles() {
  const [roles] = await db.query('SELECT id, name, display_name, description FROM roles ORDER BY id ASC');
  return roles;
}

/**
 * Admin: Get Audit Logs with Filtering and Pagination
 */
async function getAuditLogs(filters = {}, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const whereClauses = [];
  const params = [];

  if (filters.action) {
    whereClauses.push('a.action = ?');
    params.push(filters.action);
  }
  if (filters.user_id) {
    whereClauses.push('a.user_id = ?');
    params.push(parseInt(filters.user_id, 10));
  }
  if (filters.search) {
    whereClauses.push('(a.action LIKE ? OR a.entity LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     ${whereSql}`,
    params
  );

  const total = countRows[0].total;

  const [logs] = await db.query(
    `SELECT a.id, a.user_id, a.action, a.entity, a.entity_id, a.ip_address, a.user_agent, a.details_json, a.created_at,
            u.full_name as user_name, u.email as user_email, r.name as role_name
     FROM audit_logs a
     LEFT JOIN users u ON a.user_id = u.id
     LEFT JOIN roles r ON u.role_id = r.id
     ${whereSql}
     ORDER BY a.id DESC
     LIMIT ? OFFSET ?`,
    [...params, parseInt(limit, 10), parseInt(offset, 10)]
  );

  return { logs, total };
}

module.exports = {
  registerPatient,
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  getUsersList,
  toggleUserStatus,
  createUserByAdmin,
  getRoles,
  getAuditLogs
};
