const express = require('express');
const router = express.Router();
const emergencyController = require('../controllers/emergency.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateRegisterEmergencyVisit,
  validateTriageAssessment,
  validateEmergencyClinicalNote,
  validateEmergencyTreatment,
  validateAdmitToIpd
} = require('../validators/emergency.validator');

// 1. Emergency KPIs & Statistics
router.get(
  '/stats',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist'),
  emergencyController.getEmergencyStats
);

// 2. Emergency Encounters Queue
router.get(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist'),
  emergencyController.listEmergencyVisits
);

router.get(
  '/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist'),
  emergencyController.getEmergencyVisitById
);

router.post(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist'),
  validate(validateRegisterEmergencyVisit),
  emergencyController.registerEmergencyVisit
);

// 3. Triage Assessment Update
router.patch(
  '/:id/triage',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse'),
  validate(validateTriageAssessment),
  emergencyController.updateTriage
);

// 4. Clinical Trauma & Primary Survey Notes
router.post(
  '/notes',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse'),
  validate(validateEmergencyClinicalNote),
  emergencyController.recordEmergencyClinicalNote
);

// 5. Emergency Treatments Administered
router.post(
  '/treatments',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse'),
  validate(validateEmergencyTreatment),
  emergencyController.recordEmergencyTreatment
);

// 6. One-Click Emergency -> IPD Admission
router.post(
  '/:id/admit-ipd',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse'),
  validate(validateAdmitToIpd),
  emergencyController.admitToIpd
);

// 7. Emergency Transfer (ICU / Surgery / External)
router.post(
  '/:id/transfer',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse'),
  emergencyController.transferPatient
);

// 8. Emergency Discharge
router.post(
  '/:id/discharge',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse'),
  emergencyController.dischargePatient
);

module.exports = router;
