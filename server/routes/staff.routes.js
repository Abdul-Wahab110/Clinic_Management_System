const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateAddStaff,
  validateUpdateStaff,
  validateUpdateStatus,
  validateAssignDepartment
} = require('../validators/staff.validator');

// 1. Staff Statistics & KPIs
router.get(
  '/stats',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  staffController.getStaffStats
);

// 2. Staff Directory
router.get(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist', 'accountant'),
  staffController.listStaff
);

router.get(
  '/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist', 'accountant'),
  staffController.getStaffById
);

router.post(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateAddStaff),
  staffController.addStaff
);

router.put(
  '/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateUpdateStaff),
  staffController.updateStaff
);

// 3. Status Toggle
router.patch(
  '/:id/status',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateUpdateStatus),
  staffController.updateStaffStatus
);

// 4. Department Assignment
router.patch(
  '/:id/department',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateAssignDepartment),
  staffController.assignDepartment
);

module.exports = router;
