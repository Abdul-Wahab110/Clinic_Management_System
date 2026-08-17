const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateBookAppointment,
  validateRescheduleAppointment,
  validateUpdateAppointmentStatus,
  validateListAppointments
} = require('../validators/appointment.validator');

// 1. Statistics KPIs (Staff & Authenticated)
router.get('/stats', authenticate, appointmentController.getAppointmentStats);

// 2. Available Slots (Public or Authenticated)
router.get('/available-slots', appointmentController.getAvailableSlots);

// 3. List Appointments with filters & pagination
router.get('/', authenticate, validate(validateListAppointments), appointmentController.listAppointments);

// 4. Get Appointment Details
router.get('/:id', authenticate, appointmentController.getAppointmentById);

// 5. Approve Appointment Request (Super Admin, Hospital Admin, Assigned Doctor)
router.post(
  '/:id/approve',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  appointmentController.approveAppointment
);

// 6. Reject Appointment Request (Super Admin, Hospital Admin, Assigned Doctor)
router.post(
  '/:id/reject',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  appointmentController.rejectAppointment
);

// 7. Book Appointment (Open for public booking OR authenticated staff/patient)
router.post('/', (req, res, next) => {
  // Optional auth: if Authorization header present, run authenticate middleware
  if (req.headers.authorization) {
    return authenticate(req, res, () => {
      validate(validateBookAppointment)(req, res, () => {
        appointmentController.bookAppointment(req, res, next);
      });
    });
  }
  return validate(validateBookAppointment)(req, res, () => {
    appointmentController.bookAppointment(req, res, next);
  });
});

// 8. Reschedule Appointment
router.patch(
  '/:id/reschedule',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'patient'),
  validate(validateRescheduleAppointment),
  appointmentController.rescheduleAppointment
);

// 9. Update Status (Confirm, Check-In, In Progress, Complete, Cancel, No-Show)
router.patch(
  '/:id/status',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'patient'),
  validate(validateUpdateAppointmentStatus),
  appointmentController.updateAppointmentStatus
);

// 10. Delete Appointment
router.delete(
  '/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  appointmentController.deleteAppointment
);

module.exports = router;
