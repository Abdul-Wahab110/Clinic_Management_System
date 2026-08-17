const express = require('express');
const router = express.Router();
const nursingController = require('../controllers/nursing.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateCreateNursingNote,
  validateMedicationAdministration,
  validateRecordVitals,
  validateCreateWardTask
} = require('../validators/nursing.validator');

// 1. Nursing Station Statistics
router.get(
  '/stats',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'nurse', 'doctor'),
  nursingController.getNursingStats
);

// 2. Assigned Patients Roster with Priority Indicators
router.get(
  '/patients',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'nurse', 'doctor'),
  nursingController.getAssignedPatients
);

// 3. Patient Nursing Chart & Summary
router.get(
  '/patients/:id/summary',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'nurse', 'doctor'),
  nursingController.getPatientNursingSummary
);

// 4. Nursing Notes
router.get(
  '/patients/:patientId/notes',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'nurse', 'doctor'),
  nursingController.listNursingNotes
);

router.post(
  '/notes',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'nurse', 'doctor'),
  validate(validateCreateNursingNote),
  nursingController.recordNursingNote
);

// 5. Medication Administration (eMAR)
router.post(
  '/medications/administer',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'nurse', 'doctor'),
  validate(validateMedicationAdministration),
  nursingController.recordMedicationAdministration
);

// 6. Patient Vitals
router.post(
  '/vitals',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'nurse', 'doctor'),
  validate(validateRecordVitals),
  nursingController.recordVitals
);

// 7. Ward Tasks
router.get(
  '/tasks',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'nurse', 'doctor'),
  nursingController.listWardTasks
);

router.post(
  '/tasks',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'nurse', 'doctor'),
  validate(validateCreateWardTask),
  nursingController.createWardTask
);

router.patch(
  '/tasks/:id/complete',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'nurse', 'doctor'),
  nursingController.completeWardTask
);

module.exports = router;
