const db = require('../config/db');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const notificationService = require('./notification.service');

/**
 * 1. Public: Submit Contact Inquiry
 */
async function submitInquiry(data) {
  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const phone = data.phone ? data.phone.trim() : null;
  const subject = data.subject.trim();
  const message = data.message.trim();
  const departmentId = data.department_id ? parseInt(data.department_id, 10) : null;
  const inquiryType = data.inquiry_type ? data.inquiry_type.trim() : 'General Inquiry';

  const [res] = await db.query(
    `INSERT INTO contact_messages 
     (name, email, phone, subject, message, department_id, inquiry_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'new')`,
    [name, email, phone, subject, message, departmentId, inquiryType]
  );

  const inquiryId = res.insertId;

  // Broadcast high-priority admin notification for incoming patient inquiry
  try {
    await notificationService.createNotification({
      target_role: 'hospital_admin',
      type: 'system_notification',
      title: `📬 New Patient Inquiry: ${subject}`,
      message: `From: ${name} (${email}) - "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
      action_url: '/admin/inquiries',
      priority: 'normal'
    });
  } catch (_) {
    // Non-blocking notification dispatch
  }

  return {
    id: inquiryId,
    name,
    email,
    subject,
    status: 'new',
    message: 'Thank you! Your message has been received by AuraCare concierge and patient advocacy. We will reply shortly.'
  };
}

/**
 * 2. Admin: List All Inquiries with Multi-Criteria Filtering
 */
async function listInquiries(query = {}) {
  const { status, inquiry_type, department_id, search, date_from, date_to, page = 1, limit = 50 } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  if (status && status !== 'all') {
    conditions.push('cm.status = ?');
    params.push(status);
  }

  if (inquiry_type && inquiry_type !== 'all') {
    conditions.push('cm.inquiry_type = ?');
    params.push(inquiry_type);
  }

  if (department_id && department_id !== 'all') {
    conditions.push('cm.department_id = ?');
    params.push(parseInt(department_id, 10));
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(cm.name LIKE ? OR cm.email LIKE ? OR cm.phone LIKE ? OR cm.subject LIKE ? OR cm.message LIKE ?)');
    params.push(term, term, term, term, term);
  }

  if (date_from) {
    conditions.push('DATE(cm.created_at) >= ?');
    params.push(date_from);
  }

  if (date_to) {
    conditions.push('DATE(cm.created_at) <= ?');
    params.push(date_to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total FROM contact_messages cm ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await db.query(
    `SELECT 
      cm.*,
      dept.name as department_name,
      u.full_name as replied_by_name
    FROM contact_messages cm
    LEFT JOIN departments dept ON cm.department_id = dept.id
    LEFT JOIN users u ON cm.replied_by = u.id
    ${whereClause}
    ORDER BY (cm.status = 'new') DESC, cm.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    inquiries: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * 3. Admin: Get Inquiry by ID
 */
async function getInquiryById(id) {
  const [rows] = await db.query(
    `SELECT 
      cm.*,
      dept.name as department_name,
      u.full_name as replied_by_name
    FROM contact_messages cm
    LEFT JOIN departments dept ON cm.department_id = dept.id
    LEFT JOIN users u ON cm.replied_by = u.id
    WHERE cm.id = ?`,
    [id]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Contact inquiry not found.');
  }

  return rows[0];
}

/**
 * 4. Admin: Mark Inquiry as Read
 */
async function markAsRead(id, user = null) {
  const [rows] = await db.query('SELECT * FROM contact_messages WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Contact inquiry not found.');

  await db.query("UPDATE contact_messages SET status = 'read' WHERE id = ? AND status = 'new'", [id]);
  return { id, status: 'read', message: 'Inquiry marked as read.' };
}

/**
 * 5. Admin: Mark Inquiry as Replied with Reply Notes
 */
async function markAsReplied(id, replyNotes, user = null) {
  const [rows] = await db.query('SELECT * FROM contact_messages WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Contact inquiry not found.');

  const repliedBy = user ? user.id : null;

  await db.query(
    `UPDATE contact_messages SET 
      status = 'replied',
      reply_notes = ?,
      replied_by = ?,
      replied_at = NOW()
     WHERE id = ?`,
    [replyNotes.trim(), repliedBy, id]
  );

  return { id, status: 'replied', reply_notes: replyNotes.trim(), message: 'Inquiry marked as replied and archived to resolved.' };
}

/**
 * 6. Admin: Archive Inquiry
 */
async function archiveInquiry(id, user = null) {
  const [rows] = await db.query('SELECT * FROM contact_messages WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Contact inquiry not found.');

  await db.query("UPDATE contact_messages SET status = 'archived' WHERE id = ?", [id]);
  return { id, status: 'archived', message: 'Inquiry archived successfully.' };
}

/**
 * 7. Admin: Delete Inquiry
 */
async function deleteInquiry(id) {
  const [rows] = await db.query('SELECT * FROM contact_messages WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Contact inquiry not found.');

  await db.query('DELETE FROM contact_messages WHERE id = ?', [id]);
  return { id, message: 'Inquiry permanently deleted from database.' };
}

/**
 * 8. Admin: Overview Statistics for Dashboard
 */
async function getInquiryStats() {
  const [rows] = await db.query(`
    SELECT 
      COUNT(id) as total_inquiries,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_inquiries,
      SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read_inquiries,
      SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied_inquiries,
      SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived_inquiries
    FROM contact_messages
  `);

  const r = rows[0];
  return {
    total_inquiries: r.total_inquiries || 0,
    new_inquiries: r.new_inquiries || 0,
    read_inquiries: r.read_inquiries || 0,
    replied_inquiries: r.replied_inquiries || 0,
    archived_inquiries: r.archived_inquiries || 0
  };
}

module.exports = {
  submitInquiry,
  listInquiries,
  getInquiryById,
  markAsRead,
  markAsReplied,
  archiveInquiry,
  deleteInquiry,
  getInquiryStats
};
