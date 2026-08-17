const searchService = require('../services/search.service');
const { sendSuccess } = require('../utils/response');

/**
 * Global Search Endpoint
 * GET /api/v1/search?q={query}&category={category}&limit={limit}
 */
async function search(req, res, next) {
  try {
    const results = await searchService.globalSearch(req.user, req.query);
    return sendSuccess(res, results, 'Global search results retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  search
};
