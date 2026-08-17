const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');
const { validate } = require('../middleware/validate');
const {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateUpdateProfile,
  validateUserStatus,
  validateAdminCreateUser
} = require('../validators/auth.validator');

// Public Auth Endpoints
router.post('/register', validate(validateRegister), authController.register);
router.post('/login', authLimiter, validate(validateLogin), authController.login);
router.post('/forgot-password', authLimiter, validate(validateForgotPassword), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(validateResetPassword), authController.resetPassword);

// Logout Endpoint (Accepts requests always and clears cookies/tokens)
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);
router.put('/me', authenticate, validate(validateUpdateProfile), authController.updateMe);
router.post('/change-password', authenticate, validate(validateChangePassword), authController.changePassword);
router.get('/roles', authenticate, authController.getRoles);

// Admin User & Security Management Endpoints
router.get('/users', authenticate, authorize('super_admin', 'hospital_admin'), authController.getUsers);
router.post('/users', authenticate, authorize('super_admin', 'hospital_admin'), validate(validateAdminCreateUser), authController.createUser);
router.patch('/users/:id/status', authenticate, authorize('super_admin', 'hospital_admin'), validate(validateUserStatus), authController.toggleStatus);
router.get('/audit-logs', authenticate, authorize('super_admin', 'hospital_admin'), authController.getAuditLogs);

module.exports = router;
