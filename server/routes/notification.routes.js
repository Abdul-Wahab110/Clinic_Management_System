const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { validateCreateNotification } = require('../validators/notification.validator');

// 1. Get Unread Count for Header Badge
router.get(
  '/unread-count',
  authenticate,
  notificationController.getUnreadCount
);

// 2. Mark All as Read
router.patch(
  '/mark-all-read',
  authenticate,
  notificationController.markAllAsRead
);

// 3. List User Notifications with Filters
router.get(
  '/',
  authenticate,
  notificationController.listNotifications
);

// 4. Create Notification / Role Broadcast
router.post(
  '/',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'receptionist'),
  validate(validateCreateNotification),
  notificationController.createNotification
);

// 5. Individual Notification Status Operations
router.patch(
  '/:id/read',
  authenticate,
  notificationController.markAsRead
);

router.patch(
  '/:id/unread',
  authenticate,
  notificationController.markAsUnread
);

router.delete(
  '/:id',
  authenticate,
  notificationController.deleteNotification
);

module.exports = router;
