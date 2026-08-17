const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescription.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { validateCreatePrescription, validateUpdatePrescription } = require('../validators/prescription.validator');

// 1. Medicines Formulary (Dynamic from MySQL)
router.get(
  '/medicines',
  authenticate,
  prescriptionController.listMedicines
);

// 2. Prescription Order Statistics
router.get(
  '/stats',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'pharmacist'),
  prescriptionController.getPrescriptionStats
);

// 3. Master Prescription History / List
router.get(
  '/',
  authenticate,
  prescriptionController.listPrescriptions
);

// 4. View Specific Prescription Order
router.get(
  '/:id',
  authenticate,
  prescriptionController.getPrescriptionById
);

// 5. Create Prescription (Draft or Finalized)
router.post(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateCreatePrescription),
  prescriptionController.createPrescription
);

// 6. Update Draft Prescription
router.put(
  '/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateUpdatePrescription),
  prescriptionController.updatePrescription
);

// 7. Finalize Prescription (Locks record)
router.patch(
  '/:id/finalize',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  prescriptionController.finalizePrescription
);

// 8. Dispense Prescription at Pharmacy
router.patch(
  '/:id/dispense',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'pharmacist', 'doctor'),
  prescriptionController.dispensePrescription
);

module.exports = router;
