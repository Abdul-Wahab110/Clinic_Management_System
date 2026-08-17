const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { validateUpdateSettings } = require('../validators/settings.validator');

// 1. Public Settings Endpoint (Accessible without login)
// GET /api/v1/settings/public
router.get('/public', settingsController.getPublicSettings);

// 2. Full Admin Settings Endpoint
// GET /api/v1/settings
router.get(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  settingsController.getAllSettings
);

// 3. Update Hospital Settings
// PUT /api/v1/settings
router.put(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  validate(validateUpdateSettings),
  settingsController.updateSettings
);

// 4. Upload Branding Asset (Logo / Favicon)
// POST /api/v1/settings/branding-asset
router.post(
  '/branding-asset',
  authenticate,
  authorize('super_admin', 'hospital_admin'),
  settingsController.uploadBrandingAsset
);

module.exports = router;
