const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateCreatePatient,
  validateUpdatePatient,
  validatePatientStatus,
  validateAddDocument,
  validateAddMedicalRecord,
  validateAddPrescription,
  validateAddVitals
} = require('../validators/patient.validator');

// All patient routes require authentication
router.use(authenticate);

// 1. Directory, Search, Filter & Stats (Staff roles)
router.get(
  '/',
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'nurse', 'accountant', 'lab_technician', 'pharmacist'),
  patientController.listPatients
);

// 2. Register New Patient (Admin, Receptionist, Doctor, Nurse)
router.post(
  '/',
  authorize('super_admin', 'hospital_admin', 'receptionist', 'doctor', 'nurse'),
  validate(validateCreatePatient),
  patientController.createPatient
);

// 3. Single Patient Profile & Tabbed Sub-resources
// (Enforces strict data isolation: Patients can only view/access their own records)
router.get('/:id', patientController.getPatientById);
router.get('/:id/appointments', patientController.getPatientAppointments);
router.get('/:id/visits', patientController.getPatientVisits);
router.get('/:id/records', patientController.getPatientMedicalRecords);
router.get('/:id/prescriptions', patientController.getPatientPrescriptions);
router.get('/:id/lab-reports', patientController.getPatientLabReports);
router.get('/:id/invoices', patientController.getPatientInvoices);
router.get('/:id/payments', patientController.getPatientPayments);
router.get('/:id/documents', patientController.getPatientDocuments);
router.get('/:id/vitals', patientController.getPatientVitals);

// 4. Update Patient Profile
router.put(
  '/:id',
  validate(validateUpdatePatient),
  patientController.updatePatient
);

// 5. Activate / Deactivate Patient Status
router.patch(
  '/:id/status',
  authorize('super_admin', 'hospital_admin', 'receptionist'),
  validate(validatePatientStatus),
  patientController.togglePatientStatus
);

// 6. Delete / Archive Patient
router.delete(
  '/:id',
  authorize('super_admin', 'hospital_admin', 'receptionist'),
  patientController.deletePatient
);

// 7. Manage Patient Documents
router.post(
  '/:id/documents',
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'nurse', 'lab_technician', 'patient'),
  validate(validateAddDocument),
  patientController.addPatientDocument
);
router.delete(
  '/:id/documents/:docId',
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist', 'patient'),
  patientController.deletePatientDocument
);

// 8. Add Clinical Records & Regimens (EMR, Prescriptions, Vitals)
router.post(
  '/:id/records',
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateAddMedicalRecord),
  patientController.addMedicalRecord
);

router.post(
  '/:id/prescriptions',
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateAddPrescription),
  patientController.addPrescription
);

router.post(
  '/:id/vitals',
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist'),
  validate(validateAddVitals),
  patientController.addPatientVitals
);

module.exports = router;
