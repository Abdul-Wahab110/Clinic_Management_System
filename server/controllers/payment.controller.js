const paymentService = require('../services/payment.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listPaymentMethods(req, res, next) {
  try {
    const methods = await paymentService.listPaymentMethods(req.query);
    return sendSuccess(res, methods, 'Payment methods retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createPaymentMethod(req, res, next) {
  try {
    const result = await paymentService.createPaymentMethod(req.body);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updatePaymentMethod(req, res, next) {
  try {
    const result = await paymentService.updatePaymentMethod(req.params.id, req.body);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listPayments(req, res, next) {
  try {
    const result = await paymentService.listPayments(req.query);
    return sendSuccess(res, result.payments, 'Payment transactions retrieved successfully.', result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getPaymentById(req, res, next) {
  try {
    const payment = await paymentService.getPaymentById(req.params.id);
    return sendSuccess(res, payment, 'Payment receipt details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function recordPayment(req, res, next) {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const result = await paymentService.recordPayment(req.body, req.user, ipAddress);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function processRefund(req, res, next) {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const result = await paymentService.processRefund(req.body, req.user, ipAddress);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getPaymentAuditLogs(req, res, next) {
  try {
    const logs = await paymentService.getPaymentAuditLogs(req.query);
    return sendSuccess(res, logs, 'Payment audit trail logs retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getPaymentStats(req, res, next) {
  try {
    const stats = await paymentService.getPaymentStats();
    return sendSuccess(res, stats, 'Payment statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  listPayments,
  getPaymentById,
  recordPayment,
  processRefund,
  getPaymentAuditLogs,
  getPaymentStats
};
