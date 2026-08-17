const billingService = require('../services/billing.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listServices(req, res, next) {
  try {
    const services = await billingService.listServices(req.query);
    return sendSuccess(res, services, 'Hospital billing services catalog retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createService(req, res, next) {
  try {
    const result = await billingService.createService(req.body);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateService(req, res, next) {
  try {
    const result = await billingService.updateService(req.params.id, req.body);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listInvoices(req, res, next) {
  try {
    const result = await billingService.listInvoices(req.query);
    return sendSuccess(res, result.invoices, 'Hospital invoices retrieved successfully.', result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getInvoiceById(req, res, next) {
  try {
    const invoice = await billingService.getInvoiceById(req.params.id);
    return sendSuccess(res, invoice, 'Invoice details and itemized breakdown retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createInvoice(req, res, next) {
  try {
    const result = await billingService.createInvoice(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function processPayment(req, res, next) {
  try {
    const result = await billingService.processPayment(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function cancelInvoice(req, res, next) {
  try {
    const result = await billingService.cancelInvoice(req.params.id, req.body.reason, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getBillingReports(req, res, next) {
  try {
    const reports = await billingService.getBillingReports();
    return sendSuccess(res, reports, 'Hospital billing and revenue reports retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getBillingStats(req, res, next) {
  try {
    const stats = await billingService.getBillingStats();
    return sendSuccess(res, stats, 'Billing KPIs and financial statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listServices,
  createService,
  updateService,
  listInvoices,
  getInvoiceById,
  createInvoice,
  processPayment,
  cancelInvoice,
  getBillingReports,
  getBillingStats
};
