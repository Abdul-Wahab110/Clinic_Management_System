const adminDashboardService = require('../services/adminDashboard.service');
const { sendSuccess } = require('../utils/response');

/**
 * Super Admin & Hospital Admin Dashboard Analytics
 */
async function getDashboardStats(req, res, next) {
  try {
    const stats = await adminDashboardService.getAdminDashboardStats(req.query);
    return sendSuccess(res, stats, 'Admin dashboard metrics and analytics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboardStats
};
