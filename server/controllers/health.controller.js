const healthService = require('../services/health.service');
const { sendSuccess, sendError } = require('../utils/response');

async function getHealth(req, res, next) {
  try {
    const health = await healthService.checkSystemHealth();
    if (health.status === 'healthy') {
      return sendSuccess(res, health, 'System is healthy and fully operational', 200);
    } else {
      return res.status(503).json({
        success: false,
        statusCode: 503,
        errorCode: 'SERVICE_DEGRADED',
        message: 'System or database connection is degraded',
        data: health,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHealth
};
