const db = require('../config/db');

/**
 * Super Admin & Hospital Admin Comprehensive Live Dashboard Analytics
 * Computes all 9 KPI cards and 6 Analytics data series directly from MySQL.
 */
async function getAdminDashboardStats(filter = {}) {
  // =========================================================================
  // 1. NINE DASHBOARD KPI CARDS (Live MySQL)
  // =========================================================================

  // Card 1: Total Patients (and new this month)
  const [patientsRow] = await db.query(`
    SELECT 
      COUNT(*) as total_patients,
      SUM(CASE WHEN created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as new_last_30_days,
      SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as registered_today
    FROM patients
  `);

  // Card 2: Today's Appointments (and breakdown by status)
  const [apptsTodayRow] = await db.query(`
    SELECT 
      COUNT(*) as today_total,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as today_confirmed,
      SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) as today_checked_in,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as today_in_progress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as today_completed,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as today_cancelled
    FROM appointments 
    WHERE appointment_date = CURDATE()
  `);

  // Card 3: Today's Revenue (collected payments today + invoiced today)
  const [revTodayRow] = await db.query(`
    SELECT 
      COALESCE(SUM(amount_paid), 0) as revenue_collected_today,
      COUNT(id) as payments_count_today
    FROM payments 
    WHERE DATE(payment_date) = CURDATE()
  `);

  const [invTodayRow] = await db.query(`
    SELECT 
      COALESCE(SUM(net_amount), 0) as invoiced_today,
      COUNT(id) as invoices_count_today
    FROM invoices 
    WHERE DATE(invoice_date) = CURDATE() AND status != 'cancelled'
  `);

  // Card 4: Doctors (Total, Active, On Duty Today)
  const [doctorsRow] = await db.query(`
    SELECT 
      COUNT(*) as total_doctors,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_doctors,
      SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) as available_doctors
    FROM doctors
  `);

  // Card 5: Staff (Total, Active, by Department)
  const [staffRow] = await db.query(`
    SELECT 
      COUNT(*) as total_staff,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_staff
    FROM staff_profiles
  `);

  // Card 6: Available Beds (IPD Capacity & Occupancy Rate)
  const [bedsRow] = await db.query(`
    SELECT 
      COUNT(*) as total_beds,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_beds,
      SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_beds,
      SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_beds
    FROM beds
  `);

  // Card 7: Pending Bills (Unpaid / Partially Paid Invoices & Outstanding Balance)
  const [pendingBillsRow] = await db.query(`
    SELECT 
      COUNT(*) as pending_invoices_count,
      COALESCE(SUM(remaining_amount), 0) as total_outstanding_amount,
      COALESCE(SUM(net_amount), 0) as total_pending_net_invoiced
    FROM invoices 
    WHERE status IN ('issued', 'partially_paid', 'draft') AND remaining_amount > 0
  `);

  // Card 8: Lab Orders (Total, Today's Requisitions, Pending Results)
  const [labOrdersRow] = await db.query(`
    SELECT 
      COUNT(*) as total_lab_orders,
      SUM(CASE WHEN DATE(order_date) = CURDATE() THEN 1 ELSE 0 END) as orders_today,
      SUM(CASE WHEN status IN ('pending', 'sample_collected', 'in_progress', 'processing') THEN 1 ELSE 0 END) as pending_lab_orders,
      SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_lab_orders
    FROM lab_orders
  `);

  // Card 9: Low Stock Items (Medicines & Inventory below reorder thresholds)
  const [lowStockMeds] = await db.query(`
    SELECT COUNT(*) as low_stock_medicines FROM medicines WHERE stock_quantity <= min_stock_level
  `);
  const [lowStockInv] = await db.query(`
    SELECT COUNT(*) as low_stock_inventory FROM inventory_items WHERE current_stock <= min_stock_level
  `);

  const lowStockCount = (lowStockMeds[0].low_stock_medicines || 0) + (lowStockInv[0].low_stock_inventory || 0);

  // =========================================================================
  // 2. SIX ADVANCED ANALYTICS DATA SERIES (JavaScript Charting)
  // =========================================================================

  // Analytics 1: Patient Growth (Monthly registrations over the past 12 months)
  const [patientGrowth] = await db.query(`
    SELECT 
      DATE_FORMAT(created_at, '%Y-%m') as period,
      DATE_FORMAT(created_at, '%b %Y') as label,
      COUNT(id) as count
    FROM patients 
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
    GROUP BY period, label
    ORDER BY period ASC
  `);

  // Analytics 2: Appointment Trends (Monthly volume + completed vs cancelled/no-show)
  const [appointmentTrends] = await db.query(`
    SELECT 
      DATE_FORMAT(appointment_date, '%Y-%m') as period,
      DATE_FORMAT(appointment_date, '%b %Y') as label,
      COUNT(id) as total_appointments,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status IN ('cancelled', 'no_show') THEN 1 ELSE 0 END) as cancelled_or_no_show
    FROM appointments 
    WHERE appointment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY period, label
    ORDER BY period ASC
  `);

  // Analytics 3: Revenue Trends (Monthly payments collected vs net invoiced)
  const [revenueTrends] = await db.query(`
    SELECT 
      m.period,
      m.label,
      COALESCE(p.collected, 0) as collected,
      COALESCE(i.invoiced, 0) as invoiced
    FROM (
      SELECT DISTINCT DATE_FORMAT(payment_date, '%Y-%m') as period, DATE_FORMAT(payment_date, '%b %Y') as label
      FROM payments WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      UNION
      SELECT DISTINCT DATE_FORMAT(invoice_date, '%Y-%m') as period, DATE_FORMAT(invoice_date, '%b %Y') as label
      FROM invoices WHERE invoice_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    ) m
    LEFT JOIN (
      SELECT DATE_FORMAT(payment_date, '%Y-%m') as period, SUM(amount_paid) as collected
      FROM payments GROUP BY period
    ) p ON m.period = p.period
    LEFT JOIN (
      SELECT DATE_FORMAT(invoice_date, '%Y-%m') as period, SUM(net_amount) as invoiced
      FROM invoices WHERE status != 'cancelled' GROUP BY period
    ) i ON m.period = i.period
    ORDER BY m.period ASC
  `);

  // Analytics 4: Department Performance (Appointments volume, doctors count, revenue)
  const [departmentPerformance] = await db.query(`
    SELECT 
      d.id,
      d.name as department_name,
      d.code as department_code,
      COUNT(DISTINCT a.id) as appointments_count,
      COUNT(DISTINCT doc.id) as doctors_count,
      COALESCE(SUM(i.net_amount), 0) as total_invoiced_revenue
    FROM departments d
    LEFT JOIN appointments a ON a.department_id = d.id
    LEFT JOIN doctors doc ON doc.department_id = d.id
    LEFT JOIN invoices i ON a.id = i.appointment_id AND i.status != 'cancelled'
    GROUP BY d.id, d.name, d.code
    ORDER BY appointments_count DESC, total_invoiced_revenue DESC
    LIMIT 8
  `);

  // Analytics 5: Laboratory Activity (Requisitions by status & top test categories)
  const [labCategoryActivity] = await db.query(`
    SELECT 
      COALESCE(lt.category, loi.category_name, 'General Diagnostics') as category_name,
      COUNT(loi.id) as total_tests_ordered,
      SUM(CASE WHEN loi.status = 'completed' THEN 1 ELSE 0 END) as completed_tests
    FROM lab_order_items loi
    LEFT JOIN lab_tests lt ON loi.test_id = lt.id
    GROUP BY category_name
    ORDER BY total_tests_ordered DESC
    LIMIT 6
  `);

  const [labStatusBreakdown] = await db.query(`
    SELECT 
      status,
      COUNT(*) as count
    FROM lab_orders
    GROUP BY status
  `);

  // Analytics 6: Pharmacy Activity (Monthly prescriptions & top dispensed categories)
  const [pharmacyActivity] = await db.query(`
    SELECT 
      DATE_FORMAT(created_at, '%Y-%m') as period,
      DATE_FORMAT(created_at, '%b %Y') as label,
      COUNT(id) as total_prescriptions,
      SUM(CASE WHEN status = 'dispensed' THEN 1 ELSE 0 END) as dispensed,
      SUM(CASE WHEN status = 'finalized' THEN 1 ELSE 0 END) as finalized,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts
    FROM prescription_orders
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY period, label
    ORDER BY period ASC
  `);

  const [topMedicines] = await db.query(`
    SELECT 
      COALESCE(m.name, pi.medicine_name) as medicine_name,
      COALESCE(m.form, 'Tablet') as form,
      COUNT(pi.id) as prescription_frequency,
      COALESCE(SUM(pi.quantity), 0) as total_quantity_prescribed
    FROM prescription_items pi
    LEFT JOIN medicines m ON pi.medicine_id = m.id
    GROUP BY medicine_name, form
    ORDER BY prescription_frequency DESC
    LIMIT 6
  `);

  // =========================================================================
  // 3. RECENT ACTIVITY & CRITICAL HOSPITAL ALERTS
  // =========================================================================
  const [recentAppointments] = await db.query(`
    SELECT 
      a.id, a.appointment_number, a.appointment_date, a.appointment_time, a.status, a.reason,
      p.id as patient_id, p.first_name, p.last_name, p.patient_code, p.phone,
      d.name as department_name,
      u.full_name as doctor_name
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN departments d ON a.department_id = d.id
    LEFT JOIN doctors doc ON a.doctor_id = doc.id
    LEFT JOIN users u ON doc.user_id = u.id
    ORDER BY a.appointment_date DESC, a.appointment_time DESC
    LIMIT 8
  `);

  const [recentInvoices] = await db.query(`
    SELECT 
      i.id, i.invoice_number, i.invoice_date, i.net_amount, i.paid_amount, i.remaining_amount, i.status,
      p.first_name, p.last_name, p.patient_code
    FROM invoices i
    JOIN patients p ON i.patient_id = p.id
    ORDER BY i.created_at DESC
    LIMIT 6
  `);

  const totalBeds = bedsRow[0].total_beds || 0;
  const occupiedBeds = bedsRow[0].occupied_beds || 0;
  const occupancyRate = totalBeds > 0 ? parseFloat(((occupiedBeds / totalBeds) * 100).toFixed(1)) : 0;

  return {
    // 9 KPI Cards
    cards: {
      total_patients: {
        count: patientsRow[0].total_patients || 0,
        new_last_30_days: patientsRow[0].new_last_30_days || 0,
        registered_today: patientsRow[0].registered_today || 0
      },
      today_appointments: {
        count: apptsTodayRow[0].today_total || 0,
        confirmed: apptsTodayRow[0].today_confirmed || 0,
        checked_in: apptsTodayRow[0].today_checked_in || 0,
        in_progress: apptsTodayRow[0].today_in_progress || 0,
        completed: apptsTodayRow[0].today_completed || 0,
        cancelled: apptsTodayRow[0].today_cancelled || 0
      },
      today_revenue: {
        collected: parseFloat(revTodayRow[0].revenue_collected_today) || 0,
        invoiced: parseFloat(invTodayRow[0].invoiced_today) || 0,
        payments_count: revTodayRow[0].payments_count_today || 0
      },
      doctors: {
        total: doctorsRow[0].total_doctors || 0,
        active: doctorsRow[0].active_doctors || 0,
        available: doctorsRow[0].available_doctors || 0
      },
      staff: {
        total: staffRow[0].total_staff || 0,
        active: staffRow[0].active_staff || 0
      },
      available_beds: {
        total: totalBeds,
        available: bedsRow[0].available_beds || 0,
        occupied: occupiedBeds,
        occupancy_rate_percent: occupancyRate
      },
      pending_bills: {
        count: pendingBillsRow[0].pending_invoices_count || 0,
        total_outstanding_amount: parseFloat(pendingBillsRow[0].total_outstanding_amount) || 0,
        total_pending_invoiced: parseFloat(pendingBillsRow[0].total_pending_net_invoiced) || 0
      },
      lab_orders: {
        total: labOrdersRow[0].total_lab_orders || 0,
        orders_today: labOrdersRow[0].orders_today || 0,
        pending: labOrdersRow[0].pending_lab_orders || 0,
        verified: labOrdersRow[0].verified_lab_orders || 0
      },
      low_stock_items: {
        total: lowStockCount,
        medicines: lowStockMeds[0].low_stock_medicines || 0,
        inventory: lowStockInv[0].low_stock_inventory || 0
      }
    },

    // 6 Analytics Data Series
    analytics: {
      patient_growth: patientGrowth,
      appointment_trends: appointmentTrends,
      revenue_trends: revenueTrends,
      department_performance: departmentPerformance,
      lab_activity: {
        categories: labCategoryActivity,
        status_breakdown: labStatusBreakdown
      },
      pharmacy_activity: {
        monthly: pharmacyActivity,
        top_medicines: topMedicines
      }
    },

    // Recent Activity Feeds
    recent_appointments: recentAppointments,
    recent_invoices: recentInvoices
  };
}

module.exports = {
  getAdminDashboardStats
};
