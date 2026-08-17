const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateCreateDoctor,
  validateUpdateDoctor,
  validateDoctorStatus,
  validateDoctorSchedules
} = require('../validators/doctor.validator');

// 1. Public & Staff Department & Doctor Listings
router.get('/departments', doctorController.getDepartments);
router.get('/doctors', doctorController.getDoctors);
router.get('/doctors/stats', authenticate, authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist'), doctorController.getDoctorStats);
router.get('/doctors/:id', doctorController.getDoctorById);
router.get('/doctors/:id/schedules', doctorController.getDoctorSchedules);

// 2. Doctor Management CRUD (Admin / Authorized Staff)
router.post(
  '/doctors',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateCreateDoctor),
  doctorController.createDoctor
);

router.put(
  '/doctors/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateUpdateDoctor),
  doctorController.updateDoctor
);

router.patch(
  '/doctors/:id/status',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateDoctorStatus),
  doctorController.updateDoctorStatus
);

router.put(
  '/doctors/:id/schedules',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateDoctorSchedules),
  doctorController.updateDoctorSchedules
);

router.delete(
  '/doctors/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  doctorController.deleteDoctor
);

module.exports = router;
