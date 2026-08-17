const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { validateUploadDocument } = require('../validators/document.validator');

// All document routes require authentication
router.use(authenticate);

// 1. Get Document Stats (Role-Scoped)
// GET /api/v1/documents/stats
router.get('/stats', documentController.getDocumentStats);

// 2. List Documents (Role-Scoped: Patients only see own, Staff see based on clinical access)
// GET /api/v1/documents
router.get('/', documentController.listDocuments);

// 3. Upload New Patient Document
// POST /api/v1/documents
router.post(
  '/',
  authorize('super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist'),
  validate(validateUploadDocument),
  documentController.uploadDocument
);

// 4. Get Document Metadata
// GET /api/v1/documents/:id
router.get('/:id', documentController.getDocumentById);

// 5. Secure Download Document (Sets Content-Disposition: attachment)
// GET /api/v1/documents/:id/download
router.get('/:id/download', documentController.downloadDocument);

// 6. Secure View/Stream Document Inline
// GET /api/v1/documents/:id/view
router.get('/:id/view', documentController.viewDocument);

// 7. Archive Document
// PATCH /api/v1/documents/:id/archive
router.patch(
  '/:id/archive',
  authorize('super_admin', 'hospital_admin', 'doctor'),
  documentController.archiveDocument
);

// 8. Delete Document
// DELETE /api/v1/documents/:id
router.delete(
  '/:id',
  authorize('super_admin', 'hospital_admin', 'doctor'),
  documentController.deleteDocument
);

module.exports = router;
