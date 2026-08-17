const db = require('../config/db');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');

/**
 * List Notifications with User Isolation & Filtering
 */
async function listNotifications(user, query = {}) {
  const { notification_type, is_read, priority, search, page = 1, limit = 50 } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  // Strict User Isolation: Non-admin users can only view their own notifications
  if (['super_admin', 'hospital_admin'].includes(user.role) && query.all_users === 'true') {
    if (query.user_id) {
      conditions.push('n.user_id = ?');
      params.push(parseInt(query.user_id, 10));
    }
  } else {
    conditions.push('n.user_id = ?');
    params.push(user.id);
  }

  if (notification_type && notification_type !== 'all') {
    conditions.push('n.notification_type = ?');
    params.push(notification_type);
  }

  if (is_read !== undefined && is_read !== 'all') {
    conditions.push('n.is_read = ?');
    params.push(is_read === 'true' || is_read === '1' ? 1 : 0);
  }

  if (priority && priority !== 'all') {
    conditions.push('n.priority = ?');
    params.push(priority);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(n.title LIKE ? OR n.message LIKE ?)');
    params.push(term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total FROM notifications n ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [unreadCountRows] = await db.query(
    `SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
    [user.id]
  );
  const unreadCount = unreadCountRows[0].unread_count;

  const [rows] = await db.query(
    `SELECT 
      n.*,
      u.full_name as recipient_name,
      u.email as recipient_email
    FROM notifications n
    JOIN users u ON n.user_id = u.id
    ${whereClause}
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    notifications: rows,
    unread_count: unreadCount,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Get Real-time Unread Notification Count for Badges
 */
async function getUnreadCount(user) {
  const [rows] = await db.query(
    `SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
    [user.id]
  );
  return { unread_count: rows[0].unread_count || 0 };
}

/**
 * Create Database-Backed Notification
 */
async function createNotification(data, actorUser) {
  const notifType = data.notification_type || 'system_notification';
  const priority = data.priority || 'normal';

  // Support broadcasting to an entire role
  if (data.target_role) {
    const [targetUsers] = await db.query(
      `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = ? AND u.status = 'active'`,
      [data.target_role]
    );

    if (targetUsers.length === 0) throw new NotFoundError(`No active users found with role '${data.target_role}'.`);

    for (const u of targetUsers) {
      await db.query(
        `INSERT INTO notifications 
         (user_id, title, message, notification_type, priority, action_url, reference_id, reference_type, is_read)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          u.id,
          data.title.trim(),
          data.message.trim(),
          notifType,
          priority,
          data.action_url || null,
          data.reference_id || null,
          data.reference_type || null
        ]
      );
    }

    return { message: `Notification broadcast to ${targetUsers.length} users with role '${data.target_role}'.` };
  }

  const targetUserId = parseInt(data.user_id, 10);
  const [userCheck] = await db.query('SELECT id FROM users WHERE id = ?', [targetUserId]);
  if (userCheck.length === 0) throw new NotFoundError('Target recipient user not found.');

  const [res] = await db.query(
    `INSERT INTO notifications 
     (user_id, title, message, notification_type, priority, action_url, reference_id, reference_type, is_read)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      targetUserId,
      data.title.trim(),
      data.message.trim(),
      notifType,
      priority,
      data.action_url || null,
      data.reference_id || null,
      data.reference_type || null
    ]
  );

  return {
    id: res.insertId,
    user_id: targetUserId,
    title: data.title,
    message: 'Notification delivered successfully.'
  };
}

/**
 * Mark Single Notification as Read
 */
async function markAsRead(id, user) {
  const [rows] = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Notification not found.');
  const notif = rows[0];

  // User isolation verification
  if (notif.user_id !== user.id && !['super_admin', 'hospital_admin'].includes(user.role)) {
    throw new ForbiddenError('Unauthorized: You can only modify your own notifications.');
  }

  await db.query('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?', [id]);
  return { id, is_read: true, message: 'Notification marked as read.' };
}

/**
 * Mark Single Notification as Unread
 */
async function markAsUnread(id, user) {
  const [rows] = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Notification not found.');
  const notif = rows[0];

  if (notif.user_id !== user.id && !['super_admin', 'hospital_admin'].includes(user.role)) {
    throw new ForbiddenError('Unauthorized: You can only modify your own notifications.');
  }

  await db.query('UPDATE notifications SET is_read = 0, read_at = NULL WHERE id = ?', [id]);
  return { id, is_read: false, message: 'Notification marked as unread.' };
}

/**
 * Mark All Notifications as Read for User
 */
async function markAllAsRead(user) {
  const [res] = await db.query(
    'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
    [user.id]
  );
  return { affected_rows: res.affectedRows, message: 'All notifications marked as read.' };
}

/**
 * Delete Notification
 */
async function deleteNotification(id, user) {
  const [rows] = await db.query('SELECT * FROM notifications WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Notification not found.');
  const notif = rows[0];

  if (notif.user_id !== user.id && !['super_admin', 'hospital_admin'].includes(user.role)) {
    throw new ForbiddenError('Unauthorized: You can only delete your own notifications.');
  }

  await db.query('DELETE FROM notifications WHERE id = ?', [id]);
  return { id, message: 'Notification deleted.' };
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
