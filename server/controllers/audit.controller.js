const auditService = require('../services/audit.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listAuditLogs(req, res, next) {
  try {
    const result = await auditService.listAuditLogs(req.query);
    return sendSuccess(res, result.logs, 'Audit logs retrieved successfully.', {
      ...result.pagination,
      metrics: result.metrics
    });
  } catch (error) {
    next(error);
  }
}

async function getAuditLogById(req, res, next) {
  try {
    const result = await auditService.getAuditLogById(req.params.id);
    return sendSuccess(res, result, 'Audit event details retrieved.');
  } catch (error) {
    next(error);
  }
}

async function getAuditStats(req, res, next) {
  try {
    const result = await auditService.getAuditStats();
    return sendSuccess(res, result, 'Audit statistics and distributions retrieved.');
  } catch (error) {
    next(error);
  }
}

async function logAuditEvent(req, res, next) {
  try {
    const data = {
      ...req.body,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.headers['user-agent']
    };
    const result = await auditService.logAuditEvent(data);
    return sendCreated(res, result, 'Audit event recorded.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAuditLogs,
  getAuditLogById,
  getAuditStats,
  logAuditEvent
};
