const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateRecordPayment,
  validateProcessRefund,
  validateCreatePaymentMethod
} = require('../validators/payment.validator');

// 1. Payment Statistics & KPIs
router.get(
  '/stats',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant', 'receptionist'),
  paymentController.getPaymentStats
);

// 2. Audit Trail Logs
router.get(
  '/audit-logs',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant'),
  paymentController.getPaymentAuditLogs
);

// 3. Payment Methods Catalog
router.get(
  '/methods',
  authenticate,
  paymentController.listPaymentMethods
);

router.post(
  '/methods',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant'),
  validate(validateCreatePaymentMethod),
  paymentController.createPaymentMethod
);

router.put(
  '/methods/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant'),
  paymentController.updatePaymentMethod
);

// 4. Payments Ledger & Transactions
router.get(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant', 'receptionist'),
  paymentController.listPayments
);

router.get(
  '/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant', 'receptionist', 'patient'),
  paymentController.getPaymentById
);

router.post(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant', 'receptionist'),
  validate(validateRecordPayment),
  paymentController.recordPayment
);

// 5. Authorized Refunds
router.post(
  '/refund',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'accountant'),
  validate(validateProcessRefund),
  paymentController.processRefund
);

module.exports = router;
