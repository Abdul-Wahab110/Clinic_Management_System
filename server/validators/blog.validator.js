function validateCreateArticle(body) {
  const errors = [];
  if (!body.title || body.title.trim().length === 0) {
    errors.push('Article title is required.');
  }
  if (!body.content || body.content.trim().length === 0) {
    errors.push('Article content body is required.');
  }
  if (body.status && !['draft', 'published', 'archived'].includes(body.status)) {
    errors.push("Status must be one of: 'draft', 'published', 'archived'.");
  }
  return errors;
}

function validateUpdateArticle(body) {
  const errors = [];
  if (body.title !== undefined && body.title.trim().length === 0) {
    errors.push('Article title cannot be blank.');
  }
  if (body.content !== undefined && body.content.trim().length === 0) {
    errors.push('Article content body cannot be blank.');
  }
  if (body.status && !['draft', 'published', 'archived'].includes(body.status)) {
    errors.push("Status must be one of: 'draft', 'published', 'archived'.");
  }
  return errors;
}

module.exports = {
  validateCreateArticle,
  validateUpdateArticle
};
