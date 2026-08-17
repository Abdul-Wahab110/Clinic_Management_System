const userManagementService = require('../services/userManagement.service');
const { sendSuccess, sendPaginated } = require('../utils/response');

async function listUsers(req, res, next) {
  try {
    const { search, role, status, sortBy, sortOrder, page, limit } = req.query;
    const result = await userManagementService.listUsers({ search, role, status, sortBy, sortOrder, page, limit });
    return sendPaginated(res, result.users, result.total, result.page, result.limit, 'Users retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getUserDetails(req, res, next) {
  try {
    const user = await userManagementService.getUserDetails(req.params.id);
    return sendSuccess(res, user, 'User details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const user = await userManagementService.createUser(req.body, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, user, 'User account created successfully.', 201);
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const user = await userManagementService.updateUser(req.params.id, req.body, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, user, 'User updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function changeRole(req, res, next) {
  try {
    const { role_id } = req.body;
    const user = await userManagementService.changeUserRole(req.params.id, role_id, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, user, 'User role updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const { status } = req.body;
    const user = await userManagementService.toggleUserStatus(req.params.id, status, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, user, `User status updated to ${status}.`);
  } catch (error) {
    next(error);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { new_password } = req.body;
    const result = await userManagementService.adminResetPassword(req.params.id, new_password, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const result = await userManagementService.deleteUser(req.params.id, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listUsers,
  getUserDetails,
  createUser,
  updateUser,
  changeRole,
  toggleStatus,
  resetPassword,
  deleteUser
};
