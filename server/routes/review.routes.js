const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { validateCreateReview, validateModerateReview } = require('../validators/review.validator');

// --- PUBLIC & PATIENT ROUTES ---

// 1. List Approved Reviews (with search, rating, doctor, and department filters)
router.get('/', reviewController.listPublicReviews);

// 2. Get Featured Testimonials for Homepage
router.get('/featured', reviewController.getFeaturedReviews);

// 3. Submit New Patient Review (Anti-spam duplicate protected)
router.post(
  '/',
  optionalAuth,
  validate(validateCreateReview),
  reviewController.submitReview
);

// --- ADMIN MODERATION ROUTES ---

// 4. Admin Review Stats
router.get(
  '/admin/stats',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  reviewController.getReviewStats
);

// 5. Admin List All Reviews (Pending, Approved, Rejected, Hidden)
router.get(
  '/admin/all',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  reviewController.listAdminReviews
);

// 6. Admin Update Status (Approve, Reject, Hide)
router.patch(
  '/admin/:id/status',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateModerateReview),
  reviewController.updateReviewStatus
);

// 7. Admin Toggle Featured
router.patch(
  '/admin/:id/featured',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  reviewController.toggleFeatured
);

// 8. Admin Delete Review
router.delete(
  '/admin/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  reviewController.deleteReview
);

module.exports = router;
