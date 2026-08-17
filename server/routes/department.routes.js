const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateCreateDepartment,
  validateUpdateDepartment,
  validateDepartmentStatus,
  validateAssignDoctor
} = require('../validators/department.validator');

// 1. Public & Staff Department Listings
router.get('/', departmentController.getDepartments);
router.get('/stats', authenticate, authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist'), departmentController.getDepartmentStats);
router.get('/:id', departmentController.getDepartmentById);
router.get('/:id/doctors', departmentController.getDepartmentDoctors);

// 2. Admin Protected Department Operations
router.post(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateCreateDepartment),
  departmentController.createDepartment
);

router.put(
  '/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateUpdateDepartment),
  departmentController.updateDepartment
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateDepartmentStatus),
  departmentController.updateDepartmentStatus
);

router.post(
  '/:id/assign-doctor',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateAssignDoctor),
  departmentController.assignDoctorToDepartment
);

router.delete(
  '/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  departmentController.deleteDepartment
);

module.exports = router;
