const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { validateContactSubmission, validateReplyInquiry } = require('../validators/contact.validator');

// --- PUBLIC INQUIRY SUBMISSION ---
// POST /api/v1/contact
router.post('/', validate(validateContactSubmission), contactController.submitInquiry);

// --- ADMIN INQUIRY MANAGEMENT ---
// GET /api/v1/contact/inquiries/stats
router.get(
  '/inquiries/stats',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'receptionist'),
  contactController.getInquiryStats
);

// GET /api/v1/contact/inquiries
router.get(
  '/inquiries',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'receptionist'),
  contactController.listInquiries
);

// GET /api/v1/contact/inquiries/:id
router.get(
  '/inquiries/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'receptionist'),
  contactController.getInquiryById
);

// PATCH /api/v1/contact/inquiries/:id/read
router.patch(
  '/inquiries/:id/read',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'receptionist'),
  contactController.markAsRead
);

// PATCH /api/v1/contact/inquiries/:id/reply
router.patch(
  '/inquiries/:id/reply',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'receptionist'),
  validate(validateReplyInquiry),
  contactController.markAsReplied
);

// PATCH /api/v1/contact/inquiries/:id/archive
router.patch(
  '/inquiries/:id/archive',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'receptionist'),
  contactController.archiveInquiry
);

// DELETE /api/v1/contact/inquiries/:id
router.delete(
  '/inquiries/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  contactController.deleteInquiry
);

module.exports = router;
