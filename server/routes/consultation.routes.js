const express = require('express');
const router = express.Router();
const consultationController = require('../controllers/consultation.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { validateSaveConsultation } = require('../validators/consultation.validator');

// 1. Get Patient Complete Clinical EMR Summary (Allergies, Medical History, Previous Visits, Diagnoses, Prescriptions, Labs)
router.get(
  '/patients/:patientId/clinical-summary',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse', 'patient'),
  consultationController.getPatientClinicalSummary
);

// 2. Save Non-Overwriting Doctor Consultation & EMR Encounter
router.post(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateSaveConsultation),
  consultationController.saveConsultationRecord
);

router.post(
  '/encounters',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateSaveConsultation),
  consultationController.saveConsultationRecord
);

// 3. Get Specific Medical Record / Encounter Details by ID
router.get(
  '/records/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse', 'patient'),
  consultationController.getMedicalRecordById
);

module.exports = router;
