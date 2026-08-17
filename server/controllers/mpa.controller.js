const mpaService = require('../services/mpa.service');
const { sendSuccess } = require('../utils/response');

async function getServices(req, res, next) {
  try {
    const data = await mpaService.getServices();
    return sendSuccess(res, data, 'Services retrieved successfully.');
  } catch (err) { next(err); }
}

async function getBlogPosts(req, res, next) {
  try {
    const data = await mpaService.getBlogPosts();
    return sendSuccess(res, data, 'Blog posts retrieved.');
  } catch (err) { next(err); }
}

async function getBlogPostBySlug(req, res, next) {
  try {
    const data = await mpaService.getBlogPostBySlug(req.params.slug);
    return sendSuccess(res, data, 'Blog post details retrieved.');
  } catch (err) { next(err); }
}

async function getReviews(req, res, next) {
  try {
    const data = await mpaService.getReviews();
    return sendSuccess(res, data, 'Reviews retrieved.');
  } catch (err) { next(err); }
}

async function submitContact(req, res, next) {
  try {
    const result = await mpaService.saveContactMessage(req.body);
    return sendSuccess(res, result, result.message, 201);
  } catch (err) { next(err); }
}

async function getMedicines(req, res, next) {
  try {
    const data = await mpaService.getMedicines();
    return sendSuccess(res, data, 'Medicines inventory retrieved.');
  } catch (err) { next(err); }
}

async function getLabTests(req, res, next) {
  try {
    const data = await mpaService.getLabTests();
    return sendSuccess(res, data, 'Lab test catalog retrieved.');
  } catch (err) { next(err); }
}

async function getWards(req, res, next) {
  try {
    const data = await mpaService.getWards();
    return sendSuccess(res, data, 'Hospital wards retrieved.');
  } catch (err) { next(err); }
}

async function getAdminOverview(req, res, next) {
  try {
    const data = await mpaService.getAdminOverview();
    return sendSuccess(res, data, 'Admin overview data retrieved.');
  } catch (err) { next(err); }
}

module.exports = {
  getServices,
  getBlogPosts,
  getBlogPostBySlug,
  getReviews,
  submitContact,
  getMedicines,
  getLabTests,
  getWards,
  getAdminOverview
};
