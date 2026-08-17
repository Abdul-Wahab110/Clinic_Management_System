const validCategories = ['cash', 'card', 'bank', 'digital', 'insurance', 'other'];
const validRefundStatuses = ['approved', 'processed', 'rejected'];

function validateRecordPayment(body) {
  const errors = [];
  if (!body.invoice_id || isNaN(body.invoice_id) || parseInt(body.invoice_id, 10) <= 0) {
    errors.push('Valid invoice ID is required.');
  }
  if (!body.amount_paid || isNaN(body.amount_paid) || parseFloat(body.amount_paid) <= 0) {
    errors.push('Payment amount must be greater than zero.');
  }
  if (!body.payment_method || body.payment_method.trim().length === 0) {
    errors.push('Payment method is required.');
  }
  return errors;
}

function validateProcessRefund(body) {
  const errors = [];
  if (!body.payment_id || isNaN(body.payment_id) || parseInt(body.payment_id, 10) <= 0) {
    errors.push('Valid payment ID is required.');
  }
  if (!body.refund_amount || isNaN(body.refund_amount) || parseFloat(body.refund_amount) <= 0) {
    errors.push('Refund amount must be greater than zero.');
  }
  if (!body.refund_reason || body.refund_reason.trim().length === 0) {
    errors.push('Clinical or administrative refund reason is required.');
  }
  return errors;
}

function validateCreatePaymentMethod(body) {
  const errors = [];
  if (!body.code || body.code.trim().length === 0) {
    errors.push('Payment method code is required.');
  }
  if (!body.name || body.name.trim().length === 0) {
    errors.push('Payment method display name is required.');
  }
  if (body.category && !validCategories.includes(body.category)) {
    errors.push(`Category must be one of: ${validCategories.join(', ')}.`);
  }
  return errors;
}

module.exports = {
  validateRecordPayment,
  validateProcessRefund,
  validateCreatePaymentMethod
};
