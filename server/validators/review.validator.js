function validateCreateReview(body) {
  const errors = [];
  if (!body.rating || isNaN(body.rating) || parseInt(body.rating, 10) < 1 || parseInt(body.rating, 10) > 5) {
    errors.push('Rating must be an integer between 1 and 5.');
  }
  if (!body.comment || body.comment.trim().length < 5) {
    errors.push('Review comment must be at least 5 characters long.');
  }
  if (!body.patient_name || body.patient_name.trim().length === 0) {
    errors.push('Patient name is required.');
  }
  return errors;
}

function validateModerateReview(body) {
  const errors = [];
  if (body.status && !['pending', 'approved', 'rejected', 'hidden'].includes(body.status)) {
    errors.push("Status must be one of: 'pending', 'approved', 'rejected', 'hidden'.");
  }
  return errors;
}

module.exports = {
  validateCreateReview,
  validateModerateReview
};
