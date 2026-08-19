const express = require('express');
const router = express.Router();

const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const departmentRoutes = require('./department.routes');
const doctorRoutes = require('./doctor.routes');
const scheduleRoutes = require('./schedule.routes');
const appointmentRoutes = require('./appointment.routes');
const opdRoutes = require('./opd.routes');
const consultationRoutes = require('./consultation.routes');
const prescriptionRoutes = require('./prescription.routes');
const labRoutes = require('./lab.routes');
const radiologyRoutes = require('./radiology.routes');
const pharmacyRoutes = require('./pharmacy.routes');
const inventoryRoutes = require('./inventory.routes');
const ipdRoutes = require('./ipd.routes');
const nursingRoutes = require('./nursing.routes');
const billingRoutes = require('./billing.routes');
const paymentRoutes = require('./payment.routes');
const emergencyRoutes = require('./emergency.routes');
const staffRoutes = require('./staff.routes');
const reportRoutes = require('./report.routes');
const notificationRoutes = require('./notification.routes');
const blogRoutes = require('./blog.routes');
const reviewRoutes = require('./review.routes');
const contactRoutes = require('./contact.routes');
const documentRoutes = require('./document.routes');
const auditRoutes = require('./audit.routes');
const searchRoutes = require('./search.routes');
const settingsRoutes = require('./settings.routes');
const portalRoutes = require('./portal.routes');
const adminRoutes = require('./admin.routes');
const patientRoutes = require('./patient.routes');
const mpaRoutes = require('./mpa.routes');

// Direct /api/health endpoint
router.use('/health', healthRoutes);

// Version 1 API Root (/api/v1/...)
const v1Router = express.Router();
v1Router.use('/health', healthRoutes);
v1Router.use('/auth', authRoutes);
v1Router.use('/admin', adminRoutes);
v1Router.use('/search', searchRoutes);
v1Router.use('/departments', departmentRoutes);
v1Router.use('/patients', patientRoutes);
v1Router.use('/schedules', scheduleRoutes);
v1Router.use('/opd', opdRoutes);
v1Router.use('/consultations', consultationRoutes);
v1Router.use('/emr', consultationRoutes);
v1Router.use('/prescriptions', prescriptionRoutes);
v1Router.use('/lab', labRoutes);
v1Router.use('/radiology', radiologyRoutes);
v1Router.use('/pharmacy', pharmacyRoutes);
v1Router.use('/inventory', inventoryRoutes);
v1Router.use('/ipd', ipdRoutes);
v1Router.use('/nursing', nursingRoutes);
v1Router.use('/billing', billingRoutes);
v1Router.use('/payments', paymentRoutes);
v1Router.use('/emergency', emergencyRoutes);
v1Router.use('/staff', staffRoutes);
v1Router.use('/reports', reportRoutes);
v1Router.use('/notifications', notificationRoutes);
v1Router.use('/blog', blogRoutes);
v1Router.use('/reviews', reviewRoutes);
v1Router.use('/contact', contactRoutes);
v1Router.use('/documents', documentRoutes);
v1Router.use('/audit-logs', auditRoutes);
v1Router.use('/audit', auditRoutes);
v1Router.use('/settings', settingsRoutes);
v1Router.use('/', doctorRoutes);
v1Router.use('/appointments', appointmentRoutes);
v1Router.use('/categories', (req, res, next) => {
  req.url = '/categories' + (req.url.startsWith('/') ? req.url.slice(1) : req.url);
  blogRoutes(req, res, next);
});
v1Router.use('/posts', (req, res, next) => {
  req.url = '/posts' + (req.url.startsWith('/') ? req.url.slice(1) : req.url);
  blogRoutes(req, res, next);
});

router.use('/v1', v1Router);
router.use('/', v1Router);

module.exports = router;
