const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateCreateBillingService,
  validateCreateInvoice,
  validateProcessPayment
} = require('../validators/billing.validator');

// 1. Billing KPIs & Statistics
router.get(
  '/stats',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant', 'receptionist'),
  billingController.getBillingStats
);

// 2. Billing & Revenue Reports
router.get(
  '/reports',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant'),
  billingController.getBillingReports
);

// 3. Billing Services Catalog
router.get(
  '/services',
  authenticate,
  billingController.listServices
);

router.post(
  '/services',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant'),
  validate(validateCreateBillingService),
  billingController.createService
);

router.put(
  '/services/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant'),
  billingController.updateService
);

// 4. Invoices Management
router.get(
  '/invoices',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant', 'receptionist', 'doctor'),
  billingController.listInvoices
);

router.get(
  '/invoices/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant', 'receptionist', 'doctor', 'patient'),
  billingController.getInvoiceById
);

router.post(
  '/invoices',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant', 'receptionist'),
  validate(validateCreateInvoice),
  billingController.createInvoice
);

router.patch(
  '/invoices/:id/cancel',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant'),
  billingController.cancelInvoice
);

// 5. Payment Processing
router.post(
  '/payments',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant', 'receptionist'),
  validate(validateProcessPayment),
  billingController.processPayment
);

module.exports = router;
