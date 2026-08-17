const authService = require('../services/auth.service');
const { sendSuccess, sendPaginated } = require('../utils/response');

async function register(req, res, next) {
  try {
    const result = await authService.registerPatient(req.body, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, 'Registration successful. Welcome to AuraCare!', 201);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password, req.ip, req.get('user-agent'));
    
    // Set cookie if needed
    res.cookie('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    return sendSuccess(res, result, 'Login successful. Welcome back!');
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    res.clearCookie('auth_token');
    return sendSuccess(res, null, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const profile = await authService.getProfile(req.user.id);
    return sendSuccess(res, profile, 'Profile retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function updateMe(req, res, next) {
  try {
    const profile = await authService.updateProfile(req.user.id, req.body, req.ip, req.get('user-agent'));
    return sendSuccess(res, profile, 'Profile updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    const result = await authService.changePassword(
      req.user.id,
      current_password,
      new_password,
      req.ip,
      req.get('user-agent')
    );
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const result = await authService.forgotPassword(req.body.email, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, new_password } = req.body;
    const result = await authService.resetPassword(token, new_password, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getUsers(req, res, next) {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const { users, total } = await authService.getUsersList({ role, status, search }, page, limit);
    return sendPaginated(res, users, total, page, limit, 'Users retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await authService.toggleUserStatus(id, status, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const result = await authService.createUserByAdmin(req.body, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, 'User account created successfully.', 201);
  } catch (error) {
    next(error);
  }
}

async function getRoles(req, res, next) {
  try {
    const roles = await authService.getRoles();
    return sendSuccess(res, roles, 'Roles retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getAuditLogs(req, res, next) {
  try {
    const { action, user_id, search, page = 1, limit = 20 } = req.query;
    const { logs, total } = await authService.getAuditLogs({ action, user_id, search }, page, limit);
    return sendPaginated(res, logs, total, page, limit, 'Audit logs retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
  getUsers,
  toggleStatus,
  createUser,
  getRoles,
  getAuditLogs
};
