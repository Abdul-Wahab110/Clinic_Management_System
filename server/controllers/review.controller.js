const reviewService = require('../services/review.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listPublicReviews(req, res, next) {
  try {
    const result = await reviewService.listPublicReviews(req.query);
    return sendSuccess(res, result.reviews, 'Approved patient reviews retrieved successfully.', 200, {
      pagination: result.pagination,
      metrics: result.metrics
    });
  } catch (error) {
    next(error);
  }
}

async function getFeaturedReviews(req, res, next) {
  try {
    const result = await reviewService.getFeaturedReviews(req.query.limit);
    return sendSuccess(res, result, 'Featured patient testimonials retrieved.', 200);
  } catch (error) {
    next(error);
  }
}

async function submitReview(req, res, next) {
  try {
    const result = await reviewService.submitReview(req.body, req.user || null);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listAdminReviews(req, res, next) {
  try {
    const result = await reviewService.listAdminReviews(req.query);
    return sendSuccess(res, result.reviews, 'Admin reviews retrieved successfully.', 200, {
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

async function updateReviewStatus(req, res, next) {
  try {
    const { status, admin_notes } = req.body;
    const result = await reviewService.updateReviewStatus(req.params.id, status, admin_notes, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function toggleFeatured(req, res, next) {
  try {
    const { is_featured } = req.body;
    const result = await reviewService.toggleFeatured(req.params.id, is_featured);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function deleteReview(req, res, next) {
  try {
    const result = await reviewService.deleteReview(req.params.id);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getReviewStats(req, res, next) {
  try {
    const result = await reviewService.getReviewStats();
    return sendSuccess(res, result, 'Review metrics and stats retrieved.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listPublicReviews,
  getFeaturedReviews,
  submitReview,
  listAdminReviews,
  updateReviewStatus,
  toggleFeatured,
  deleteReview,
  getReviewStats
};
