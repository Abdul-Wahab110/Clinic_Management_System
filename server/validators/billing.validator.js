const validServiceTypes = [
  'consultation',
  'laboratory',
  'radiology',
  'pharmacy',
  'room_charge',
  'procedure',
  'general_service'
];

const validPaymentMethods = [
  'cash',
  'credit_card',
  'debit_card',
  'bank_transfer',
  'insurance_claim',
  'online_portal'
];

const validInvoiceStatuses = ['unpaid', 'partially_paid', 'paid', 'cancelled', 'refunded'];

function validateCreateBillingService(body) {
  const errors = [];
  if (!body.service_name || body.service_name.trim().length === 0) {
    errors.push('Service name is required.');
  }
  if (!body.service_code || body.service_code.trim().length === 0) {
    errors.push('Service code is required.');
  }
  if (!body.service_type || !validServiceTypes.includes(body.service_type)) {
    errors.push(`Service type must be one of: ${validServiceTypes.join(', ')}.`);
  }
  if (body.standard_price === undefined || isNaN(body.standard_price) || parseFloat(body.standard_price) < 0) {
    errors.push('A valid non-negative standard price is required.');
  }
  return errors;
}

function validateCreateInvoice(body) {
  const errors = [];
  if (!body.patient_id || isNaN(body.patient_id) || parseInt(body.patient_id, 10) <= 0) {
    errors.push('Valid patient ID is required.');
  }
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push('At least one line item must be included in the invoice.');
  } else {
    body.items.forEach((item, idx) => {
      if (!item.item_name || item.item_name.trim().length === 0) {
        errors.push(`Item #${idx + 1}: Description / service name is required.`);
      }
      if (!item.quantity || isNaN(item.quantity) || parseInt(item.quantity, 10) <= 0) {
        errors.push(`Item #${idx + 1}: Quantity must be at least 1.`);
      }
      if (item.unit_price === undefined || isNaN(item.unit_price) || parseFloat(item.unit_price) < 0) {
        errors.push(`Item #${idx + 1}: Valid non-negative unit price is required.`);
      }
      if (item.service_type && !validServiceTypes.includes(item.service_type)) {
        errors.push(`Item #${idx + 1}: Service type must be one of: ${validServiceTypes.join(', ')}.`);
      }
    });
  }
  return errors;
}

function validateProcessPayment(body) {
  const errors = [];
  if (!body.invoice_id || isNaN(body.invoice_id) || parseInt(body.invoice_id, 10) <= 0) {
    errors.push('Valid invoice ID is required.');
  }
  if (!body.amount_paid || isNaN(body.amount_paid) || parseFloat(body.amount_paid) <= 0) {
    errors.push('Payment amount must be greater than zero.');
  }
  if (body.payment_method && !validPaymentMethods.includes(body.payment_method)) {
    errors.push(`Payment method must be one of: ${validPaymentMethods.join(', ')}.`);
  }
  return errors;
}

module.exports = {
  validateCreateBillingService,
  validateCreateInvoice,
  validateProcessPayment
};
