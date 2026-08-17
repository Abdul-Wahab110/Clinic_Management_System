const db = require('../config/db');
const logger = require('../utils/logger');
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} = require('../utils/errors');

/**
 * List all roles with user counts and permission counts
 */
async function listRoles() {
  const [roles] = await db.query(
    `SELECT r.id, r.name, r.display_name, r.description, r.is_system, r.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) as user_count,
            (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) as permission_count
     FROM roles r
     ORDER BY r.id ASC`
  );
  return roles;
}

/**
 * Get detailed role info with its assigned permissions
 */
async function getRoleDetails(roleId, conn = null) {
  const client = conn || db;
  const [roles] = await client.query(
    `SELECT r.id, r.name, r.display_name, r.description, r.is_system, r.created_at,
            (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) as user_count
     FROM roles r
     WHERE r.id = ?`,
    [roleId]
  );

  if (roles.length === 0) {
    throw new NotFoundError('Role not found.');
  }

  const role = roles[0];

  const [permissions] = await client.query(
    `SELECT p.id, p.code, p.module, p.description
     FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     WHERE rp.role_id = ?
     ORDER BY p.module ASC, p.code ASC`,
    [roleId]
  );

  return {
    ...role,
    is_system: Boolean(role.is_system),
    permissions,
    permission_ids: permissions.map(p => p.id)
  };
}

/**
 * Create a new custom role
 */
async function createRole(data, actorUser, ip = null, userAgent = null) {
  const cleanName = data.name.trim().toLowerCase().replace(/\s+/g, '_');

  const [existing] = await db.query('SELECT id FROM roles WHERE LOWER(name) = ? LIMIT 1', [cleanName]);
  if (existing.length > 0) {
    throw new ConflictError(`A role with code "${cleanName}" already exists.`);
  }

  let newRoleId;
  await db.withTransaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO roles (name, display_name, description, is_system)
       VALUES (?, ?, ?, 0)`,
      [cleanName, data.display_name.trim(), data.description || null]
    );

    newRoleId = result.insertId;

    if (Array.isArray(data.permission_ids) && data.permission_ids.length > 0) {
      const values = data.permission_ids.map(pId => [newRoleId, parseInt(pId, 10)]);
      await conn.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [values]);
    }

    await logger.audit(actorUser.id, 'ADMIN_CREATED_ROLE', 'roles', newRoleId, ip, userAgent, {
      roleName: cleanName,
      displayName: data.display_name,
      permissionsAssigned: data.permission_ids ? data.permission_ids.length : 0
    }, conn);
  });

  return await getRoleDetails(newRoleId);
}

/**
 * Update role display name & description
 */
async function updateRole(roleId, data, actorUser, ip = null, userAgent = null) {
  const [roles] = await db.query('SELECT id, name, is_system FROM roles WHERE id = ?', [roleId]);
  if (roles.length === 0) throw new NotFoundError('Role not found.');

  const role = roles[0];

  const updates = [];
  const params = [];

  if (data.display_name) {
    updates.push('display_name = ?');
    params.push(data.display_name.trim());
  }

  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description ? data.description.trim() : null);
  }

  if (updates.length > 0) {
    params.push(roleId);
    await db.query(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  await logger.audit(actorUser.id, 'ADMIN_UPDATED_ROLE', 'roles', roleId, ip, userAgent, {
    roleName: role.name,
    updates: Object.keys(data)
  });

  return await getRoleDetails(roleId);
}

/**
 * Delete a custom role (blocks deleting system roles or roles with assigned users)
 */
async function deleteRole(roleId, actorUser, ip = null, userAgent = null) {
  const [roles] = await db.query('SELECT id, name, is_system FROM roles WHERE id = ?', [roleId]);
  if (roles.length === 0) throw new NotFoundError('Role not found.');

  const role = roles[0];
  if (role.is_system) {
    throw new ForbiddenError(`Cannot delete system role "${role.name}". System roles are protected.`);
  }

  const [userCount] = await db.query('SELECT COUNT(*) as count FROM users WHERE role_id = ?', [roleId]);
  if (userCount[0].count > 0) {
    throw new ConflictError(`Cannot delete role "${role.name}" because ${userCount[0].count} user account(s) are assigned to it.`);
  }

  await db.withTransaction(async (conn) => {
    await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    await conn.query('DELETE FROM roles WHERE id = ?', [roleId]);
    await logger.audit(actorUser.id, 'ADMIN_DELETED_ROLE', 'roles', roleId, ip, userAgent, { roleName: role.name }, conn);
  });

  return { message: `Role "${role.name}" deleted successfully.` };
}

/**
 * List all permissions grouped by module
 */
async function listPermissions() {
  const [permissions] = await db.query(
    `SELECT id, code, module, description
     FROM permissions
     ORDER BY module ASC, code ASC`
  );

  // Group by module
  const grouped = {};
  permissions.forEach(p => {
    if (!grouped[p.module]) {
      grouped[p.module] = [];
    }
    grouped[p.module].push(p);
  });

  return {
    permissions,
    total: permissions.length,
    grouped
  };
}

/**
 * Get Full Role-Permission Matrix
 */
async function getRolePermissionMatrix() {
  const roles = await listRoles();
  const { permissions, grouped } = await listPermissions();

  const [assignments] = await db.query('SELECT role_id, permission_id FROM role_permissions');
  const assignmentMap = new Set(assignments.map(a => `${a.role_id}_${a.permission_id}`));

  const matrix = roles.map(role => {
    const rolePerms = permissions.map(p => ({
      permissionId: p.id,
      code: p.code,
      module: p.module,
      granted: assignmentMap.has(`${role.id}_${p.id}`)
    }));

    return {
      roleId: role.id,
      name: role.name,
      displayName: role.display_name,
      isSystem: Boolean(role.is_system),
      permissions: rolePerms,
      grantedCount: rolePerms.filter(p => p.granted).length
    };
  });

  return {
    roles,
    permissions,
    groupedPermissions: grouped,
    matrix
  };
}

/**
 * Update Role Permissions in real-time
 */
async function updateRolePermissions(roleId, permissionIds, actorUser, ip = null, userAgent = null) {
  const [roles] = await db.query('SELECT id, name, is_system FROM roles WHERE id = ?', [roleId]);
  if (roles.length === 0) throw new NotFoundError('Role not found.');

  const role = roles[0];

  // Super Admin safety check: Super Admin always retains all permissions
  if (role.name === 'super_admin') {
    const [allPerms] = await db.query('SELECT id FROM permissions');
    permissionIds = allPerms.map(p => p.id);
  }

  const validIds = Array.isArray(permissionIds) ? permissionIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id)) : [];

  await db.withTransaction(async (conn) => {
    await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

    if (validIds.length > 0) {
      const values = validIds.map(pId => [roleId, pId]);
      await conn.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [values]);
    }

    await logger.audit(actorUser.id, 'ADMIN_UPDATED_ROLE_PERMISSIONS', 'roles', roleId, ip, userAgent, {
      roleName: role.name,
      newPermissionCount: validIds.length
    }, conn);
  });

  return await getRoleDetails(roleId);
}

/**
 * Update Full Role-Permission Matrix atomically
 */
async function updateMatrix(matrixAssignments, actorUser, ip = null, userAgent = null) {
  return await db.withTransaction(async (conn) => {
    const [allPerms] = await conn.query('SELECT id FROM permissions');
    const allPermIds = allPerms.map(p => p.id);

    for (const [roleIdStr, permIds] of Object.entries(matrixAssignments)) {
      const roleId = parseInt(roleIdStr, 10);
      const [roles] = await conn.query('SELECT name FROM roles WHERE id = ?', [roleId]);
      if (roles.length === 0) continue;

      let validIds = Array.isArray(permIds) ? permIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id)) : [];
      if (roles[0].name === 'super_admin') {
        validIds = allPermIds;
      }

      await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
      if (validIds.length > 0) {
        const values = validIds.map(pId => [roleId, pId]);
        await conn.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [values]);
      }
    }

    await logger.audit(actorUser.id, 'ADMIN_UPDATED_FULL_MATRIX', 'role_permissions', null, ip, userAgent, {
      rolesUpdated: Object.keys(matrixAssignments).length
    }, conn);

    return await getRolePermissionMatrix();
  });
}

module.exports = {
  listRoles,
  getRoleDetails,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
  getRolePermissionMatrix,
  updateRolePermissions,
  updateMatrix
};
