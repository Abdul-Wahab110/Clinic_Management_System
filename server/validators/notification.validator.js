const validNotificationTypes = [
  'appointment_confirmation',
  'appointment_reminder',
  'appointment_cancellation',
  'lab_report_ready',
  'prescription_created',
  'payment_received',
  'low_stock',
  'system_notification',
  'other'
];

const validPriorities = ['urgent', 'high', 'normal', 'low'];

function validateCreateNotification(body) {
  const errors = [];
  if (!body.title || body.title.trim().length === 0) {
    errors.push('Notification title is required.');
  }
  if (!body.message || body.message.trim().length === 0) {
    errors.push('Notification message content is required.');
  }
  if (!body.user_id && !body.target_role) {
    errors.push('Either target user ID or target role is required.');
  }
  if (body.notification_type && !validNotificationTypes.includes(body.notification_type)) {
    errors.push(`Notification type must be one of: ${validNotificationTypes.join(', ')}.`);
  }
  if (body.priority && !validPriorities.includes(body.priority)) {
    errors.push(`Priority must be one of: ${validPriorities.join(', ')}.`);
  }
  return errors;
}

module.exports = {
  validateCreateNotification
};
