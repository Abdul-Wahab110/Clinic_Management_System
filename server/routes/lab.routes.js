const express = require('express');
const router = express.Router();
const labController = require('../controllers/lab.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { validateCreateLabOrder, validateSaveLabResults, validateUpdateOrderStatus } = require('../validators/lab.validator');

// 1. Laboratory Categories
router.get(
  '/categories',
  authenticate,
  labController.listLabCategories
);

// 2. Laboratory Test Catalog
router.get(
  '/tests',
  authenticate,
  labController.listLabTests
);

// 3. Specific Test Details & Parameter Templates
router.get(
  '/tests/:id',
  authenticate,
  labController.getLabTestById
);

// 4. Lab Department Statistics & KPIs
router.get(
  '/stats',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff', 'lab_technician'),
  labController.getLabStats
);

// 5. List Lab Orders
router.get(
  '/orders',
  authenticate,
  labController.listLabOrders
);

// 6. View Specific Lab Order & Multi-Parameter Results
router.get(
  '/orders/:id',
  authenticate,
  labController.getLabOrderById
);

// 7. Create New Lab Order Requisition
router.post(
  '/orders',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff', 'lab_technician'),
  validate(validateCreateLabOrder),
  labController.createLabOrder
);

// 8. Update Order Workflow Status (e.g. sample_collected, processing, completed)
router.patch(
  '/orders/:id/status',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff', 'lab_technician'),
  validate(validateUpdateOrderStatus),
  labController.updateOrderStatus
);

// 9. Enter Multi-Parameter Results
router.post(
  '/orders/:id/results',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff', 'lab_technician'),
  validate(validateSaveLabResults),
  labController.saveLabResults
);

// 10. Verify and Release Laboratory Report
router.patch(
  '/orders/:id/verify',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'lab_technician'),
  labController.verifyLabResults
);

module.exports = router;
