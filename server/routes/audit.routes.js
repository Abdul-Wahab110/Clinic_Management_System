const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authenticate, authorize } = require('../middleware/auth');

// All audit viewing routes are strictly Admin-Only
router.use(authenticate);

// 1. Get Audit Analytics & Distribution Stats
// GET /api/v1/audit-logs/stats
router.get(
  '/stats',
  authorize('super_admin', 'hospital_admin'),
  auditController.getAuditStats
);

// 2. List Audit Logs with Multi-Criteria Filters & Pagination
// GET /api/v1/audit-logs
router.get(
  '/',
  authorize('super_admin', 'hospital_admin'),
  auditController.listAuditLogs
);

// 3. Get Single Audit Event by ID
// GET /api/v1/audit-logs/:id
router.get(
  '/:id',
  authorize('super_admin', 'hospital_admin'),
  auditController.getAuditLogById
);

// 4. Log Internal System Audit Event
// POST /api/v1/audit-logs
router.post(
  '/',
  authorize('super_admin', 'hospital_admin'),
  auditController.logAuditEvent
);

module.exports = router;
