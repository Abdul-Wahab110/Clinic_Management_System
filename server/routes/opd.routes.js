const express = require('express');
const router = express.Router();
const opdController = require('../controllers/opd.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateRegisterWalkIn,
  validateCheckInAppointment,
  validateRecordVitals,
  validateCompleteConsultation
} = require('../validators/opd.validator');

// 1. Live OPD Queue Dashboard & Statuses (Staff / Doctors / Reception)
router.get(
  '/dashboard',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'nurse'),
  opdController.getOpdDashboard
);

// 2. Register Walk-In Patient & Issue Token
router.post(
  '/walk-in',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'receptionist', 'nurse'),
  validate(validateRegisterWalkIn),
  opdController.registerWalkIn
);

// 3. Check-In Scheduled Appointment & Issue Token
router.post(
  '/check-in',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'receptionist', 'nurse'),
  validate(validateCheckInAppointment),
  opdController.checkInAppointment
);

// 4. Capture / Update Triage Vitals
router.post(
  '/queues/:id/vitals',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'nurse', 'doctor', 'receptionist'),
  validate(validateRecordVitals),
  opdController.recordVitals
);

// 5. Call Patient into Consultation Room
router.patch(
  '/queues/:id/call',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist'),
  opdController.callPatient
);

// 6. Complete Consultation & Generate EMR / Invoice
router.post(
  '/queues/:id/complete',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateCompleteConsultation),
  opdController.completeConsultation
);

// 7. Mark Patient as No-Show
router.patch(
  '/queues/:id/no-show',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'nurse'),
  opdController.markNoShow
);

// 8. Reassign Attending Doctor
router.patch(
  '/queues/:id/reassign',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist'),
  opdController.reassignDoctor
);

module.exports = router;
