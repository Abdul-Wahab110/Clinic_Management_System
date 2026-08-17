const express = require('express');
const router = express.Router();
const adminUserController = require('../controllers/adminUser.controller');
const adminRoleController = require('../controllers/adminRole.controller');
const adminDashboardController = require('../controllers/adminDashboard.controller');
const { authenticate, authorize, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { validateAdminCreateUser, validateUserStatus } = require('../validators/auth.validator');

// All admin routes require authentication and Admin authorization
router.use(authenticate);
router.use(authorize('super_admin', 'hospital_admin'));

// --- EXECUTIVE DASHBOARD & REAL-TIME ANALYTICS ---
router.get('/dashboard-stats', adminDashboardController.getDashboardStats);
router.get('/analytics/dashboard', adminDashboardController.getDashboardStats);

// --- USER MANAGEMENT ENDPOINTS ---
router.get('/users', adminUserController.listUsers);
router.post('/users', validate(validateAdminCreateUser), adminUserController.createUser);
router.get('/users/:id', adminUserController.getUserDetails);
router.put('/users/:id', adminUserController.updateUser);
router.patch('/users/:id/status', validate(validateUserStatus), adminUserController.toggleStatus);
router.patch('/users/:id/role', adminUserController.changeRole);
router.post('/users/:id/reset-password', adminUserController.resetPassword);
router.delete('/users/:id', adminUserController.deleteUser);

// --- ROLE & PERMISSION MANAGEMENT ENDPOINTS ---
router.get('/roles', adminRoleController.listRoles);
router.post('/roles', adminRoleController.createRole);
router.get('/roles/:id', adminRoleController.getRoleDetails);
router.put('/roles/:id', adminRoleController.updateRole);
router.delete('/roles/:id', adminRoleController.deleteRole);

router.get('/permissions', adminRoleController.listPermissions);
router.get('/matrix', adminRoleController.getMatrix);
router.put('/matrix', adminRoleController.updateMatrix);
router.put('/roles/:id/permissions', adminRoleController.updateRolePermissions);

module.exports = router;
