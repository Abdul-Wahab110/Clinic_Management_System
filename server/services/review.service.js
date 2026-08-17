const db = require('../config/db');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/errors');

/**
 * 1. Public: List Approved Patient Reviews with Aggregated Rating Analytics
 */
async function listPublicReviews(query = {}) {
  const { doctor_id, department_id, rating, featured, search, page = 1, limit = 12 } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 12));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ["r.status = 'approved'"];
  const params = [];

  if (doctor_id && doctor_id !== 'all') {
    conditions.push('r.doctor_id = ?');
    params.push(parseInt(doctor_id, 10));
  }

  if (department_id && department_id !== 'all') {
    conditions.push('r.department_id = ?');
    params.push(parseInt(department_id, 10));
  }

  if (rating && rating !== 'all') {
    conditions.push('r.rating = ?');
    params.push(parseInt(rating, 10));
  }

  if (featured === 'true' || featured === '1') {
    conditions.push('r.is_featured = 1');
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(r.title LIKE ? OR r.comment LIKE ? OR r.patient_name LIKE ?)');
    params.push(term, term, term);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Summary Metrics (Average Rating, Total Reviews, Star Breakdown)
  const [statsRows] = await db.query(`
    SELECT 
      COUNT(id) as total_approved,
      COALESCE(AVG(rating), 5.0) as average_rating,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as count_5_star,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as count_4_star,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as count_3_star,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as count_2_star,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as count_1_star
    FROM reviews
    WHERE status = 'approved'
  `);

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total FROM reviews r ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await db.query(
    `SELECT 
      r.id, r.patient_name, r.rating, r.title, r.comment, r.is_featured, r.created_at,
      doc.id as doctor_id, u.full_name as doctor_name, doc.specialization as doctor_specialization,
      dept.id as department_id, dept.name as department_name
    FROM reviews r
    LEFT JOIN doctors doc ON r.doctor_id = doc.id
    LEFT JOIN users u ON doc.user_id = u.id
    LEFT JOIN departments dept ON r.department_id = dept.id
    ${whereClause}
    ORDER BY r.is_featured DESC, r.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  const stats = statsRows[0];

  return {
    reviews: rows,
    metrics: {
      total_reviews: stats.total_approved,
      average_rating: parseFloat(parseFloat(stats.average_rating || 5.0).toFixed(1)),
      rating_distribution: {
        five_star: stats.count_5_star || 0,
        four_star: stats.count_4_star || 0,
        three_star: stats.count_3_star || 0,
        two_star: stats.count_2_star || 0,
        one_star: stats.count_1_star || 0
      }
    },
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * 2. Public: Get Featured Testimonials
 */
async function getFeaturedReviews(limit = 6) {
  const [rows] = await db.query(
    `SELECT 
      r.id, r.patient_name, r.rating, r.title, r.comment, r.created_at,
      u.full_name as doctor_name, dept.name as department_name
    FROM reviews r
    LEFT JOIN doctors doc ON r.doctor_id = doc.id
    LEFT JOIN users u ON doc.user_id = u.id
    LEFT JOIN departments dept ON r.department_id = dept.id
    WHERE r.status = 'approved' AND r.is_featured = 1
    ORDER BY r.created_at DESC
    LIMIT ?`,
    [Math.min(20, parseInt(limit, 10) || 6)]
  );
  return rows;
}

/**
 * 3. Public / Patient: Submit Review with Anti-Spam & Duplicate Checks
 */
async function submitReview(data, user = null) {
  const patientName = (data.patient_name || (user ? user.name : '')).trim();
  const patientEmail = (data.patient_email || (user ? user.email : '')).trim().toLowerCase();
  const comment = data.comment.trim();
  const rating = Math.max(1, Math.min(5, parseInt(data.rating, 10) || 5));
  const doctorId = data.doctor_id ? parseInt(data.doctor_id, 10) : null;
  const departmentId = data.department_id ? parseInt(data.department_id, 10) : null;
  const appointmentId = data.appointment_id ? parseInt(data.appointment_id, 10) : null;

  if (!patientName) throw new BadRequestError('Patient name is required.');
  if (comment.length < 5) throw new BadRequestError('Review comment must be at least 5 characters.');

  // ANTI-SPAM RULE 1: Prevent duplicate submission with identical comment text from same user/email
  const [dupTextCheck] = await db.query(
    `SELECT id FROM reviews 
     WHERE (patient_email = ? OR patient_name = ?) AND comment = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
    [patientEmail, patientName, comment]
  );
  if (dupTextCheck.length > 0) {
    throw new ConflictError('A duplicate review with identical feedback has already been received.');
  }

  // ANTI-SPAM RULE 2: Prevent multiple reviews on the exact same appointment reference
  if (appointmentId) {
    const [appDupCheck] = await db.query(
      'SELECT id FROM reviews WHERE appointment_id = ?',
      [appointmentId]
    );
    if (appDupCheck.length > 0) {
      throw new ConflictError('A review has already been submitted for this appointment.');
    }
  }

  // Link Patient ID if available from user
  let patientId = null;
  if (user) {
    const [pRows] = await db.query('SELECT id FROM patients WHERE user_id = ?', [user.id]);
    if (pRows.length > 0) patientId = pRows[0].id;
  }

  const [res] = await db.query(
    `INSERT INTO reviews 
     (patient_id, user_id, patient_name, patient_email, doctor_id, department_id, appointment_id, rating, title, comment, status, is_featured)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
    [
      patientId,
      user ? user.id : null,
      patientName,
      patientEmail || null,
      doctorId,
      departmentId,
      appointmentId,
      rating,
      data.title ? data.title.trim() : null,
      comment
    ]
  );

  return {
    id: res.insertId,
    patient_name: patientName,
    rating,
    status: 'pending',
    message: 'Thank you! Your testimonial has been submitted and is pending clinical moderation.'
  };
}

/**
 * 4. Admin: List All Reviews (Pending, Approved, Rejected, Hidden)
 */
async function listAdminReviews(query = {}) {
  const { status, rating, search, page = 1, limit = 50 } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  if (status && status !== 'all') {
    conditions.push('r.status = ?');
    params.push(status);
  }

  if (rating && rating !== 'all') {
    conditions.push('r.rating = ?');
    params.push(parseInt(rating, 10));
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(r.patient_name LIKE ? OR r.comment LIKE ? OR r.title LIKE ?)');
    params.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total FROM reviews r ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await db.query(
    `SELECT 
      r.*,
      u.full_name as doctor_name,
      dept.name as department_name,
      app.appointment_date, app.appointment_number,
      approver.full_name as approver_name
    FROM reviews r
    LEFT JOIN doctors doc ON r.doctor_id = doc.id
    LEFT JOIN users u ON doc.user_id = u.id
    LEFT JOIN departments dept ON r.department_id = dept.id
    LEFT JOIN appointments app ON r.appointment_id = app.id
    LEFT JOIN users approver ON r.approved_by = approver.id
    ${whereClause}
    ORDER BY (r.status = 'pending') DESC, r.created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    reviews: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * 5. Admin: Update Review Status (Approve, Reject, Hide)
 */
async function updateReviewStatus(id, status, adminNotes = null, adminUser = null) {
  const [rows] = await db.query('SELECT * FROM reviews WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Review not found.');

  const approvedAt = status === 'approved' ? new Date() : null;
  const approvedBy = status === 'approved' && adminUser ? adminUser.id : null;

  await db.query(
    `UPDATE reviews SET 
      status = ?,
      admin_notes = COALESCE(?, admin_notes),
      approved_by = COALESCE(?, approved_by),
      approved_at = COALESCE(?, approved_at)
     WHERE id = ?`,
    [status, adminNotes, approvedBy, approvedAt, id]
  );

  return { id, status, message: `Review status updated to '${status}'.` };
}

/**
 * 6. Admin: Toggle Featured Testimonial
 */
async function toggleFeatured(id, isFeatured) {
  const [rows] = await db.query('SELECT * FROM reviews WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Review not found.');

  const featuredVal = isFeatured ? 1 : 0;
  await db.query('UPDATE reviews SET is_featured = ? WHERE id = ?', [featuredVal, id]);
  return { id, is_featured: featuredVal, message: `Review featured status set to ${featuredVal}.` };
}

/**
 * 7. Admin: Delete Review
 */
async function deleteReview(id) {
  const [rows] = await db.query('SELECT * FROM reviews WHERE id = ?', [id]);
  if (rows.length === 0) throw new NotFoundError('Review not found.');

  await db.query('DELETE FROM reviews WHERE id = ?', [id]);
  return { id, message: 'Review deleted successfully.' };
}

/**
 * 8. Admin: Overview Statistics for Dashboard
 */
async function getReviewStats() {
  const [rows] = await db.query(`
    SELECT 
      COUNT(id) as total_reviews,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_reviews,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_reviews,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_reviews,
      SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END) as featured_reviews,
      COALESCE(AVG(CASE WHEN status = 'approved' THEN rating END), 5.0) as average_rating
    FROM reviews
  `);
  const r = rows[0];
  return {
    total_reviews: r.total_reviews,
    pending_reviews: r.pending_reviews,
    approved_reviews: r.approved_reviews,
    rejected_reviews: r.rejected_reviews,
    featured_reviews: r.featured_reviews,
    average_rating: parseFloat(parseFloat(r.average_rating || 5.0).toFixed(1))
  };
}

module.exports = {
  listPublicReviews,
  getFeaturedReviews,
  submitReview,
  listAdminReviews,
  updateReviewStatus,
  toggleFeatured,
  deleteReview,
  getReviewStats
};
