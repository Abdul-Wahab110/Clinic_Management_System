const express = require('express');
const router = express.Router();
const ipdController = require('../controllers/ipd.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateCreateWard,
  validateCreateRoom,
  validateCreateBed,
  validateCreateAdmission,
  validatePatientTransfer,
  validatePatientDischarge,
  validateDailyRound
} = require('../validators/ipd.validator');

// 1. IPD Statistics
router.get(
  '/stats',
  authenticate,
  ipdController.getIpdStats
);

// 2. Wards
router.get(
  '/wards',
  authenticate,
  ipdController.listWards
);

router.get(
  '/wards/:id',
  authenticate,
  ipdController.getWardById
);

router.post(
  '/wards',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateCreateWard),
  ipdController.createWard
);

router.put(
  '/wards/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  ipdController.updateWard
);

// 3. Rooms
router.get(
  '/rooms',
  authenticate,
  ipdController.listRooms
);

router.post(
  '/rooms',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateCreateRoom),
  ipdController.createRoom
);

router.put(
  '/rooms/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  ipdController.updateRoom
);

// 4. Beds & Bed Visual Matrix
router.get(
  '/beds',
  authenticate,
  ipdController.listBeds
);

router.get(
  '/beds/matrix',
  authenticate,
  ipdController.getBedVisualMatrix
);

router.post(
  '/beds',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateCreateBed),
  ipdController.createBed
);

router.patch(
  '/beds/:id/status',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff', 'doctor'),
  ipdController.updateBedStatus
);

// 5. Admissions
router.get(
  '/admissions',
  authenticate,
  ipdController.listAdmissions
);

router.get(
  '/admissions/:id',
  authenticate,
  ipdController.getAdmissionById
);

router.post(
  '/admissions',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff'),
  validate(validateCreateAdmission),
  ipdController.createAdmission
);

// 6. Patient Transfers
router.post(
  '/transfers',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff'),
  validate(validatePatientTransfer),
  ipdController.transferPatient
);

// 7. Patient Discharge
router.post(
  '/admissions/:id/discharge',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff'),
  validate(validatePatientDischarge),
  ipdController.dischargePatient
);

// 8. Daily Clinical Rounds & Doctor Notes
router.get(
  '/admissions/:id/rounds',
  authenticate,
  ipdController.listDailyRounds
);

router.post(
  '/admissions/:id/rounds',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  validate(validateDailyRound),
  ipdController.addDailyRound
);

module.exports = router;
