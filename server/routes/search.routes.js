const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { authenticate } = require('../middleware/auth');

// All search operations require valid authentication
router.get('/', authenticate, searchController.search);

module.exports = router;
