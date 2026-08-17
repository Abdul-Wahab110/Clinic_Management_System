const notificationService = require('../services/notification.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listNotifications(req, res, next) {
  try {
    const result = await notificationService.listNotifications(req.user, req.query);
    return sendSuccess(res, result.notifications, 'Notifications retrieved successfully.', {
      ...result.pagination,
      unread_count: result.unread_count
    });
  } catch (error) {
    next(error);
  }
}

async function getUnreadCount(req, res, next) {
  try {
    const result = await notificationService.getUnreadCount(req.user);
    return sendSuccess(res, result, 'Unread notification count retrieved.');
  } catch (error) {
    next(error);
  }
}

async function createNotification(req, res, next) {
  try {
    const result = await notificationService.createNotification(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function markAsRead(req, res, next) {
  try {
    const result = await notificationService.markAsRead(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function markAsUnread(req, res, next) {
  try {
    const result = await notificationService.markAsUnread(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    const result = await notificationService.markAllAsRead(req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function deleteNotification(req, res, next) {
  try {
    const result = await notificationService.deleteNotification(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listNotifications,
  getUnreadCount,
  createNotification,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteNotification
};
