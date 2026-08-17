const jwt = require('jsonwebtoken');
const config = require('../config/env');
const db = require('../config/db');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * Authentication Middleware
 * Extracts and verifies JWT from Authorization header or cookies
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication token missing. Please sign in.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Your session has expired. Please sign in again.');
      }
      throw new UnauthorizedError('Invalid authentication token.');
    }

    // Verify user still exists in database and is active
    const [users] = await db.query(
      `SELECT u.id, u.role_id, u.full_name, u.email, u.phone, u.avatar_url, u.status,
              r.name as role_name, r.display_name as role_display_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? LIMIT 1`,
      [decoded.userId]
    );

    if (users.length === 0) {
      throw new UnauthorizedError('User account associated with token no longer exists.');
    }

    const user = users[0];

    if (user.status !== 'active') {
      throw new ForbiddenError(`Your account is currently ${user.status}. Please contact the clinic administrator.`);
    }

    // Fetch user permissions
    const [perms] = await db.query(
      `SELECT p.code 
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [user.role_id]
    );

    const permissions = perms.map((p) => p.code);

    req.user = {
      id: user.id,
      roleId: user.role_id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      role: user.role_name,
      roleDisplayName: user.role_display_name,
      permissions
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Role-based Authorization Middleware
 * Allows access only to specified roles
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    // Super Admin has universal access
    if (req.user.role === 'super_admin') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access forbidden. Role '${req.user.roleDisplayName || req.user.role}' is not authorized to access this resource.`
        )
      );
    }

    next();
  };
}

/**
 * Permission-based Authorization Middleware
 */
function requirePermission(permissionCode) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required.'));
    }

    // Super Admin bypass
    if (req.user.role === 'super_admin') {
      return next();
    }

    if (!req.user.permissions.includes(permissionCode)) {
      return next(new ForbiddenError(`Missing required permission: ${permissionCode}`));
    }

    next();
  };
}

/**
 * Optional Authentication Middleware
 * Attaches user if valid token present, otherwise proceeds as guest
 */
async function optionalAuth(req, res, next) {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
    }

    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const [users] = await db.query(
        `SELECT u.id, u.role_id, u.full_name, u.email, u.phone, u.avatar_url, u.status,
                r.name as role_name, r.display_name as role_display_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = ? LIMIT 1`,
        [decoded.userId]
      );
      if (users.length > 0 && users[0].status === 'active') {
        const user = users[0];
        req.user = {
          id: user.id,
          roleId: user.role_id,
          fullName: user.full_name,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatar_url,
          role: user.role_name,
          roleDisplayName: user.role_display_name
        };
      }
    } catch (_) {}

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authenticate,
  authorize,
  requirePermission,
  optionalAuth
};
