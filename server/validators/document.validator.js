const VALID_CATEGORIES = [
  'Medical Report',
  'Lab Report',
  'Prescription',
  'Referral',
  'Insurance',
  'Other'
];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/dicom'
];

const MAX_FILE_SIZE_KB = 15360; // 15 MB

function validateUploadDocument(body) {
  const errors = [];

  if (!body.patient_id || isNaN(body.patient_id) || parseInt(body.patient_id, 10) <= 0) {
    errors.push('A valid patient_id is required.');
  }

  if (!body.document_name || body.document_name.trim().length < 3) {
    errors.push('Document name is required and must be at least 3 characters.');
  }

  if (body.category && !VALID_CATEGORIES.includes(body.category)) {
    errors.push(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (body.file_size_kb && (isNaN(body.file_size_kb) || parseInt(body.file_size_kb, 10) > MAX_FILE_SIZE_KB)) {
    errors.push(`File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_KB / 1024}MB.`);
  }

  if (body.mime_type && !ALLOWED_MIME_TYPES.includes(body.mime_type)) {
    errors.push(`Invalid file type. Allowed types: PDF, PNG, JPG, WEBP, DOCX, DICOM.`);
  }

  return errors;
}

module.exports = {
  VALID_CATEGORIES,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_KB,
  validateUploadDocument
};
