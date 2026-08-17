const express = require('express');
const router = express.Router();
const healthController = require('../controllers/health.controller');

// Health Check Endpoint (GET /api/health and GET /api/v1/health)
router.get('/', healthController.getHealth);

module.exports = router;
