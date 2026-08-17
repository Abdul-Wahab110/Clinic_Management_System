const contactService = require('../services/contact.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function submitInquiry(req, res, next) {
  try {
    const result = await contactService.submitInquiry(req.body);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listInquiries(req, res, next) {
  try {
    const result = await contactService.listInquiries(req.query);
    return sendSuccess(res, result.inquiries, 'Contact inquiries retrieved.', result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getInquiryById(req, res, next) {
  try {
    const result = await contactService.getInquiryById(req.params.id);
    return sendSuccess(res, result, 'Inquiry details retrieved.');
  } catch (error) {
    next(error);
  }
}

async function markAsRead(req, res, next) {
  try {
    const result = await contactService.markAsRead(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function markAsReplied(req, res, next) {
  try {
    const { reply_notes } = req.body;
    const result = await contactService.markAsReplied(req.params.id, reply_notes, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function archiveInquiry(req, res, next) {
  try {
    const result = await contactService.archiveInquiry(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function deleteInquiry(req, res, next) {
  try {
    const result = await contactService.deleteInquiry(req.params.id);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getInquiryStats(req, res, next) {
  try {
    const result = await contactService.getInquiryStats();
    return sendSuccess(res, result, 'Inquiry analytics and summary statistics.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submitInquiry,
  listInquiries,
  getInquiryById,
  markAsRead,
  markAsReplied,
  archiveInquiry,
  deleteInquiry,
  getInquiryStats
};
