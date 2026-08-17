const express = require('express');
const router = express.Router();
const mpaController = require('../controllers/mpa.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Public Data Endpoints
router.get('/services', mpaController.getServices);
router.get('/blog', mpaController.getBlogPosts);
router.get('/blog/:slug', mpaController.getBlogPostBySlug);
router.get('/reviews', mpaController.getReviews);
router.post('/contact', mpaController.submitContact);

// Clinical Catalog Data
router.get('/medicines', mpaController.getMedicines);
router.get('/lab-tests', mpaController.getLabTests);
router.get('/wards', mpaController.getWards);

// Admin Global Telemetry Overview
router.get('/admin/overview', authenticate, authorize('super_admin', 'hospital_admin'), mpaController.getAdminOverview);

module.exports = router;
