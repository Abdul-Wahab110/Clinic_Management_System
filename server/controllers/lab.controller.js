const labService = require('../services/lab.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listLabCategories(req, res, next) {
  try {
    const categories = await labService.listLabCategories();
    return sendSuccess(res, categories, 'Laboratory categories retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function listLabTests(req, res, next) {
  try {
    const tests = await labService.listLabTests(req.query);
    return sendSuccess(res, tests, 'Laboratory test catalog retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getLabTestById(req, res, next) {
  try {
    const test = await labService.getLabTestById(req.params.id);
    return sendSuccess(res, test, 'Laboratory test details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function listLabOrders(req, res, next) {
  try {
    const result = await labService.listLabOrders(req.query, req.user);
    return sendSuccess(res, result.orders, 'Laboratory orders retrieved successfully.', 200, result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getLabOrderById(req, res, next) {
  try {
    const order = await labService.getLabOrderById(req.params.id, req.user);
    return sendSuccess(res, order, 'Laboratory order requisition details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createLabOrder(req, res, next) {
  try {
    const result = await labService.createLabOrder(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const result = await labService.updateOrderStatus(req.params.id, req.body.status, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function saveLabResults(req, res, next) {
  try {
    const result = await labService.saveLabResults(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function verifyLabResults(req, res, next) {
  try {
    const result = await labService.verifyLabResults(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getLabStats(req, res, next) {
  try {
    const stats = await labService.getLabStats(req.user);
    return sendSuccess(res, stats, 'Laboratory statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listLabCategories,
  listLabTests,
  getLabTestById,
  listLabOrders,
  getLabOrderById,
  createLabOrder,
  updateOrderStatus,
  saveLabResults,
  verifyLabResults,
  getLabStats
};
