function validateContactSubmission(body) {
  const errors = [];

  if (!body.name || body.name.trim().length < 2) {
    errors.push('Full name is required and must be at least 2 characters.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!body.email || !emailRegex.test(body.email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (!body.subject || body.subject.trim().length < 3) {
    errors.push('Subject is required and must be at least 3 characters.');
  }

  if (!body.message || body.message.trim().length < 5) {
    errors.push('Message is required and must be at least 5 characters.');
  }

  return errors;
}

function validateReplyInquiry(body) {
  const errors = [];
  if (!body.reply_notes || body.reply_notes.trim().length < 3) {
    errors.push('Reply notes are required to mark an inquiry as replied.');
  }
  return errors;
}

module.exports = {
  validateContactSubmission,
  validateReplyInquiry
};
