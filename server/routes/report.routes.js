const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middleware/auth');

// 1. Executive Master Analytics Overview
router.get(
  '/overview',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant'),
  reportController.getExecutiveOverview
);

// 2. Patient Demographics & Registrations
router.get(
  '/patients',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist'),
  reportController.getPatientRegistrationReport
);

// 3. Appointments & OPD Consultations
router.get(
  '/appointments-opd',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist'),
  reportController.getAppointmentsAndOpdReport
);

// 4. IPD Admissions, Bed Occupancy & ALOS
router.get(
  '/ipd',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse'),
  reportController.getIpdReport
);

// 5. Financial Revenue, Collections & Receivables Aging
router.get(
  '/financials',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant'),
  reportController.getFinancialRevenueReport
);

// 6. Laboratory Diagnostics Report
router.get(
  '/laboratory',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'lab_technician'),
  reportController.getLaboratoryReport
);

// 7. Pharmacy & Inventory Analytics
router.get(
  '/pharmacy',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'pharmacist'),
  reportController.getPharmacyReport
);

// 8. Doctor Productivity & Workload
router.get(
  '/doctors',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  reportController.getDoctorProductivityReport
);

// 9. Department Performance & Revenue
router.get(
  '/departments',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  reportController.getDepartmentPerformanceReport
);

module.exports = router;
