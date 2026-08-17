const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateGetAvailability,
  validateUpdateSchedules,
  validateCreateLeave,
  validateLeaveStatus
} = require('../validators/schedule.validator');

// 1. Live Public Availability Calculation (Consumed by Appointments module & Patients)
router.get('/availability', validate(validateGetAvailability), scheduleController.getDoctorAvailability);

// 2. 7-Day Timetable Matrix Overview (Admin / Doctor / Receptionist)
router.get(
  '/overview',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist'),
  scheduleController.getAllSchedulesOverview
);

// 3. Doctor Schedules by Doctor ID
router.get(
  '/doctors/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist'),
  scheduleController.getDoctorSchedules
);

router.put(
  '/doctors/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateUpdateSchedules),
  scheduleController.updateDoctorSchedules
);

// 4. Doctor Leaves & Blocked Dates Management
router.get(
  '/leaves',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist'),
  scheduleController.getDoctorLeaves
);

router.post(
  '/leaves',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateCreateLeave),
  scheduleController.applyDoctorLeave
);

router.patch(
  '/leaves/:id/status',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateLeaveStatus),
  scheduleController.updateLeaveStatus
);

module.exports = router;
