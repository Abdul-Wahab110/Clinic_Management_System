const db = require('../config/db');
const logger = require('../utils/logger');
const { NotFoundError, BadRequestError } = require('../utils/errors');

/**
 * Public & Clinical Data Queries
 */
async function getServices() {
  const [depts] = await db.query('SELECT * FROM departments WHERE is_active = 1 ORDER BY name ASC');
  return depts.map(d => ({
    id: d.id,
    name: `${d.name} Care & Treatment`,
    department: d.name,
    icon: d.icon || 'fa-heart-pulse',
    description: d.description || 'Comprehensive specialist care, diagnostics, and patient management.'
  }));
}

async function getBlogPosts() {
  const [posts] = await db.query('SELECT * FROM blog_posts ORDER BY published_at DESC');
  return posts;
}

async function getBlogPostBySlug(slug) {
  const [posts] = await db.query('SELECT * FROM blog_posts WHERE slug = ? LIMIT 1', [slug]);
  if (posts.length === 0) throw new NotFoundError('Blog post not found.');
  return posts[0];
}

async function getReviews() {
  const [reviews] = await db.query(`
    SELECT r.*, u.full_name as doctor_name 
    FROM reviews r 
    LEFT JOIN doctors d ON r.doctor_id = d.id 
    LEFT JOIN users u ON d.user_id = u.id 
    WHERE r.is_approved = 1 
    ORDER BY r.id DESC
  `);
  return reviews;
}

async function saveContactMessage(data) {
  const [res] = await db.query(
    'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
    [data.name.trim(), data.email.trim(), data.phone || null, data.subject.trim(), data.message.trim()]
  );
  return { id: res.insertId, message: 'Your message has been received. Our clinic concierge will respond shortly.' };
}

/**
 * Clinical Module Queries
 */
async function getMedicines() {
  const [rows] = await db.query('SELECT * FROM medicines ORDER BY name ASC');
  return rows;
}

async function getLabTests() {
  const [rows] = await db.query('SELECT * FROM lab_tests WHERE is_active = 1 ORDER BY category ASC, name ASC');
  return rows;
}

async function getWards() {
  const [rows] = await db.query('SELECT * FROM wards ORDER BY floor_number ASC, name ASC');
  return rows;
}

async function getAdminOverview() {
  const [userCount] = await db.query('SELECT COUNT(*) as c FROM users');
  const [docCount] = await db.query('SELECT COUNT(*) as c FROM doctors');
  const [patCount] = await db.query('SELECT COUNT(*) as c FROM patients');
  const [apptCount] = await db.query('SELECT COUNT(*) as c FROM appointments');
  const [invTotal] = await db.query('SELECT COALESCE(SUM(net_amount), 0) as total FROM invoices');
  const [medCount] = await db.query('SELECT COUNT(*) as c FROM medicines');
  const [labCount] = await db.query('SELECT COUNT(*) as c FROM lab_tests');
  const [wardCount] = await db.query('SELECT COUNT(*) as c FROM wards');
  const [recentAppts] = await db.query(`
    SELECT a.id, a.appointment_number, a.appointment_date, a.appointment_time, a.status, a.reason,
           p.first_name, p.last_name, p.patient_code,
           d.name as department_name, u.full_name as doctor_name
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN departments d ON a.department_id = d.id
    LEFT JOIN doctors doc ON a.doctor_id = doc.id
    LEFT JOIN users u ON doc.user_id = u.id
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
    LIMIT 8
  `);

  const adminDashboardService = require('./adminDashboard.service');
  const detailedStats = await adminDashboardService.getAdminDashboardStats();

  return {
    totalUsers: userCount[0].c,
    totalDoctors: docCount[0].c,
    totalPatients: patCount[0].c,
    totalAppointments: apptCount[0].c,
    totalRevenue: parseFloat(invTotal[0].total),
    totalMedicines: medCount[0].c,
    totalLabTests: labCount[0].c,
    totalWards: wardCount[0].c,
    recentAppointments: recentAppts,
    ...detailedStats
  };
}

module.exports = {
  getServices,
  getBlogPosts,
  getBlogPostBySlug,
  getReviews,
  saveContactMessage,
  getMedicines,
  getLabTests,
  getWards,
  getAdminOverview
};
