const express = require('express');
const router = express.Router();
const radiologyController = require('../controllers/radiology.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateCreateRadiologyService,
  validateCreateRadiologyOrder,
  validateScheduleRadiologyOrder,
  validateSaveRadiologyReport,
  validateUpdateRadiologyStatus
} = require('../validators/radiology.validator');

// 1. Modalities
router.get(
  '/modalities',
  authenticate,
  radiologyController.listModalities
);

// 2. Services Catalog
router.get(
  '/services',
  authenticate,
  radiologyController.listServices
);

// 3. Specific Service
router.get(
  '/services/:id',
  authenticate,
  radiologyController.getServiceById
);

// 4. Create Service (Admin)
router.post(
  '/services',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateCreateRadiologyService),
  radiologyController.createService
);

// 5. Update Service (Admin)
router.put(
  '/services/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  radiologyController.updateService
);

// 6. Radiology KPIs & Stats
router.get(
  '/stats',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff'),
  radiologyController.getRadiologyStats
);

// 7. List Orders / Queue
router.get(
  '/orders',
  authenticate,
  radiologyController.listOrders
);

// 8. View Specific Order & PACS Report File
router.get(
  '/orders/:id',
  authenticate,
  radiologyController.getOrderById
);

// 9. Create New Imaging Requisition
router.post(
  '/orders',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff'),
  validate(validateCreateRadiologyOrder),
  radiologyController.createOrder
);

// 10. Schedule Procedure / Assign Machine & Tech
router.patch(
  '/orders/:id/schedule',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff'),
  validate(validateScheduleRadiologyOrder),
  radiologyController.scheduleOrder
);

// 11. Update Order Workflow Status
router.patch(
  '/orders/:id/status',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff'),
  validate(validateUpdateRadiologyStatus),
  radiologyController.updateOrderStatus
);

// 12. Save Diagnostic Radiology Report
router.post(
  '/orders/:id/report',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff'),
  validate(validateSaveRadiologyReport),
  radiologyController.saveReport
);

// 13. Verify and Release Diagnostic Report
router.patch(
  '/orders/:id/verify',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor'),
  radiologyController.verifyReport
);

module.exports = router;
