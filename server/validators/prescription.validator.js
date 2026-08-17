const validStatuses = ['draft', 'finalized', 'dispensed', 'cancelled'];
const validRoutes = ['Oral', 'Intravenous', 'Intramuscular', 'Sublingual', 'Topical', 'Inhalation', 'Ophthalmic', 'Otic', 'Rectal', 'Transdermal'];

function validateCreatePrescription(body) {
  const errors = [];

  if (!body.patient_id || isNaN(body.patient_id) || parseInt(body.patient_id, 10) <= 0) {
    errors.push('A valid patient ID is required.');
  }

  if (body.status && !validStatuses.includes(body.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}.`);
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push('Prescription must contain at least one medication item.');
  } else {
    body.items.forEach((item, idx) => {
      if (!item.medicine_name || item.medicine_name.trim().length === 0) {
        errors.push(`Medication #${idx + 1}: Medicine name is required.`);
      }
      if (!item.dosage || item.dosage.trim().length === 0) {
        errors.push(`Medication #${idx + 1}: Dosage is required (e.g. 500mg).`);
      }
      if (!item.frequency || item.frequency.trim().length === 0) {
        errors.push(`Medication #${idx + 1}: Frequency is required (e.g. Twice daily).`);
      }
      if (!item.duration || item.duration.trim().length === 0) {
        errors.push(`Medication #${idx + 1}: Duration is required (e.g. 7 days).`);
      }
      if (item.route && !validRoutes.includes(item.route)) {
        errors.push(`Medication #${idx + 1}: Route must be one of: ${validRoutes.join(', ')}.`);
      }
    });
  }

  return errors;
}

function validateUpdatePrescription(body) {
  return validateCreatePrescription(body);
}

module.exports = {
  validateCreatePrescription,
  validateUpdatePrescription
};
