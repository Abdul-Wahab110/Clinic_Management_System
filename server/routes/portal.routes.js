const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portal.controller');
const { authenticate, authorize } = require('../middleware/auth');

// All portal routes require authentication
router.use(authenticate);

// --- PATIENT PORTAL ROUTES ---
// 1. Dashboard Overview
router.get(
  '/portal/patient/dashboard',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.getPatientDashboardOverview
);

// 2. Appointments
router.get(
  '/portal/patient/appointments',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.getPatientAppointments
);

router.post(
  '/portal/patient/appointments',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.bookPatientAppointment
);

router.patch(
  '/portal/patient/appointments/:id/cancel',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.cancelPatientAppointment
);

// 3. Medical History & Records
router.get(
  '/portal/patient/medical-history',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.getPatientMedicalHistory
);

router.get(
  '/portal/patient/records',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.getPatientMedicalHistory
);

// 4. Prescriptions
router.get(
  '/portal/patient/prescriptions',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.getPatientPrescriptions
);

// 5. Lab Reports
router.get(
  '/portal/patient/lab-reports',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.getPatientLabReports
);

// 6. Invoices & Billing
router.get(
  '/portal/patient/invoices',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.getPatientInvoices
);

// 7. Payments
router.get(
  '/portal/patient/payments',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.getPatientPayments
);

// 8. Documents
router.get(
  '/portal/patient/documents',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.getPatientDocuments
);

// 9. Profile
router.get(
  '/portal/patient/profile',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.getPatientProfile
);

router.put(
  '/portal/patient/profile',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.updatePatientProfile
);

// 9. Legacy / Generic Records
router.get(
  '/patient/my-records',
  authorize('patient', 'super_admin', 'hospital_admin'),
  portalController.getPatientSelfRecords
);

// --- DOCTOR PORTAL ROUTES ---
// 1. Doctor Dashboard Workspace Overview
router.get(
  '/portal/doctor/dashboard',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.getDoctorDashboardOverview
);

// 2. Doctor Assigned Appointments
router.get(
  '/portal/doctor/appointments',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.getDoctorAppointments
);

// 3. Doctor Treated Patients Directory
router.get(
  '/portal/doctor/patients',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.getDoctorPatients
);

// 4. Doctor Clinical Consultations & Notes
router.get(
  '/portal/doctor/consultations',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.getDoctorConsultations
);

// 5. Doctor Electronic Prescriptions
router.get(
  '/portal/doctor/prescriptions',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.getDoctorPrescriptions
);

// 6. Doctor Diagnostic Lab Orders
router.get(
  '/portal/doctor/lab-orders',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.getDoctorLabOrders
);

// 7. Doctor Follow-up Roster
router.get(
  '/portal/doctor/follow-ups',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.getDoctorFollowUps
);

// 8. Doctor Profile & Credentials
router.get(
  '/portal/doctor/profile',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.getDoctorProfile
);

router.put(
  '/portal/doctor/profile',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.updateDoctorProfile
);

// 9. Doctor Weekly Timetable & Leaves
router.get(
  '/portal/doctor/schedule',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.getDoctorSchedule
);

router.put(
  '/portal/doctor/schedule',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.updateDoctorSchedule
);

router.post(
  '/portal/doctor/leaves',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.submitDoctorLeave
);

// 10. Legacy Doctor Route
router.get(
  '/doctor/my-appointments',
  authorize('doctor', 'super_admin', 'hospital_admin'),
  portalController.getDoctorSelfAppointments
);

module.exports = router;
