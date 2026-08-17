const rolePermissionService = require('../services/rolePermission.service');
const { sendSuccess } = require('../utils/response');

async function listRoles(req, res, next) {
  try {
    const roles = await rolePermissionService.listRoles();
    return sendSuccess(res, roles, 'Roles retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getRoleDetails(req, res, next) {
  try {
    const role = await rolePermissionService.getRoleDetails(req.params.id);
    return sendSuccess(res, role, 'Role details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createRole(req, res, next) {
  try {
    const role = await rolePermissionService.createRole(req.body, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, role, 'Role created successfully.', 201);
  } catch (error) {
    next(error);
  }
}

async function updateRole(req, res, next) {
  try {
    const role = await rolePermissionService.updateRole(req.params.id, req.body, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, role, 'Role updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function deleteRole(req, res, next) {
  try {
    const result = await rolePermissionService.deleteRole(req.params.id, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listPermissions(req, res, next) {
  try {
    const result = await rolePermissionService.listPermissions();
    return sendSuccess(res, result, 'Permissions catalog retrieved.');
  } catch (error) {
    next(error);
  }
}

async function getMatrix(req, res, next) {
  try {
    const result = await rolePermissionService.getRolePermissionMatrix();
    return sendSuccess(res, result, 'Role-Permission matrix retrieved.');
  } catch (error) {
    next(error);
  }
}

async function updateRolePermissions(req, res, next) {
  try {
    const { permission_ids } = req.body;
    const result = await rolePermissionService.updateRolePermissions(req.params.id, permission_ids, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, 'Role permissions updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function updateMatrix(req, res, next) {
  try {
    const { assignments } = req.body;
    const result = await rolePermissionService.updateMatrix(assignments || {}, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, 'Role-Permission matrix updated successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listRoles,
  getRoleDetails,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
  getMatrix,
  updateRolePermissions,
  updateMatrix
};
