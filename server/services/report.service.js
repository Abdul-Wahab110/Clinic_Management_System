const db = require('../config/db');

/**
 * Helper to build MySQL SQL Date Range Clause
 */
function buildDateCondition(columnName, filter = {}) {
  const { timeframe = 'this_month', date_from, date_to } = filter;

  if (date_from && date_to) {
    return {
      clause: `DATE(${columnName}) BETWEEN ? AND ?`,
      params: [date_from, date_to]
    };
  }

  switch (timeframe) {
    case 'today':
      return { clause: `DATE(${columnName}) = CURDATE()`, params: [] };
    case 'yesterday':
      return { clause: `DATE(${columnName}) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`, params: [] };
    case 'this_week':
      return { clause: `YEARWEEK(${columnName}, 1) = YEARWEEK(CURDATE(), 1)`, params: [] };
    case 'this_month':
      return { clause: `YEAR(${columnName}) = YEAR(CURDATE()) AND MONTH(${columnName}) = MONTH(CURDATE())`, params: [] };
    case 'this_year':
      return { clause: `YEAR(${columnName}) = YEAR(CURDATE())`, params: [] };
    case 'all_time':
    default:
      return { clause: '1=1', params: [] };
  }
}

/**
 * 1. Executive Master Analytics Overview
 */
async function getExecutiveOverview(filter = {}) {
  const pDate = buildDateCondition('created_at', filter);
  const invDate = buildDateCondition('invoice_date', filter);
  const payDate = buildDateCondition('payment_date', filter);
  const appDate = buildDateCondition('appointment_date', filter);
  const opdDate = buildDateCondition('queue_date', filter);
  const admDate = buildDateCondition('admission_date', filter);
  const disDate = buildDateCondition('discharge_date', filter);
  const labDate = buildDateCondition('created_at', filter);

  // Financial KPIs
  const [invRows] = await db.query(`
    SELECT 
      COALESCE(SUM(net_amount), 0) as total_invoiced,
      COALESCE(SUM(remaining_amount), 0) as total_outstanding,
      COUNT(id) as total_invoices_count
    FROM invoices 
    WHERE ${invDate.clause} AND status != 'cancelled'`, invDate.params);

  const [payRows] = await db.query(`
    SELECT 
      COALESCE(SUM(amount_paid), 0) as total_collected,
      COALESCE(SUM(refunded_amount), 0) as total_refunded,
      COUNT(id) as total_payments_count
    FROM payments 
    WHERE ${payDate.clause}`, payDate.params);

  // Clinical Volume KPIs
  const [patRows] = await db.query(`SELECT COUNT(id) as new_patients FROM patients WHERE ${pDate.clause}`, pDate.params);
  const [appRows] = await db.query(`SELECT COUNT(id) as appointments FROM appointments WHERE ${appDate.clause}`, appDate.params);
  const [opdRows] = await db.query(`SELECT COUNT(id) as opd_consultations FROM opd_queues WHERE ${opdDate.clause}`, opdDate.params);
  const [admRows] = await db.query(`SELECT COUNT(id) as ipd_admissions FROM ipd_admissions WHERE ${admDate.clause}`, admDate.params);
  const [disRows] = await db.query(`SELECT COUNT(id) as ipd_discharges FROM ipd_admissions WHERE ${disDate.clause} AND status = 'discharged'`, disDate.params);
  const [labRows] = await db.query(`SELECT COUNT(id) as lab_orders FROM lab_orders WHERE ${labDate.clause}`, labDate.params);

  const totalInvoiced = parseFloat(invRows[0].total_invoiced);
  const totalCollected = parseFloat(payRows[0].total_collected);
  const totalOutstanding = parseFloat(invRows[0].total_outstanding);
  const netCollected = totalCollected - parseFloat(payRows[0].total_refunded);

  return {
    financials: {
      total_invoiced: totalInvoiced,
      total_collected: totalCollected,
      total_refunded: parseFloat(payRows[0].total_refunded),
      net_collected: netCollected,
      total_outstanding: totalOutstanding,
      collection_rate_percent: totalInvoiced > 0 ? parseFloat(((totalCollected / totalInvoiced) * 100).toFixed(1)) : 0.0
    },
    clinical_volumes: {
      new_patients: patRows[0].new_patients,
      appointments: appRows[0].appointments,
      opd_consultations: opdRows[0].opd_consultations,
      ipd_admissions: admRows[0].ipd_admissions,
      ipd_discharges: disRows[0].ipd_discharges,
      lab_orders: labRows[0].lab_orders
    }
  };
}

/**
 * 2. Patient Demographics & Registration Report
 */
async function getPatientRegistrationReport(filter = {}) {
  const pDate = buildDateCondition('created_at', filter);

  // Time trend
  const [trendRows] = await db.query(`
    SELECT 
      DATE(created_at) as date_key,
      DATE_FORMAT(created_at, '%b %d') as formatted_date,
      COUNT(id) as count
    FROM patients
    WHERE ${pDate.clause}
    GROUP BY DATE(created_at), DATE_FORMAT(created_at, '%b %d')
    ORDER BY date_key ASC
  `, pDate.params);

  // Gender Breakdown
  const [genderRows] = await db.query(`
    SELECT gender, COUNT(id) as count
    FROM patients
    WHERE ${pDate.clause}
    GROUP BY gender
  `, pDate.params);

  // Blood Group Breakdown
  const [bloodRows] = await db.query(`
    SELECT blood_group, COUNT(id) as count
    FROM patients
    WHERE ${pDate.clause} AND blood_group IS NOT NULL AND blood_group != ''
    GROUP BY blood_group
    ORDER BY count DESC
  `, pDate.params);

  return {
    trend: trendRows,
    gender_distribution: genderRows,
    blood_groups: bloodRows
  };
}

/**
 * 3. Appointments & Outpatient (OPD) Report
 */
async function getAppointmentsAndOpdReport(filter = {}) {
  const appDate = buildDateCondition('appointment_date', filter);
  const opdDate = buildDateCondition('queue_date', filter);

  // Appointments Status Breakdown
  const [statusRows] = await db.query(`
    SELECT status, COUNT(id) as count
    FROM appointments
    WHERE ${appDate.clause}
    GROUP BY status
  `, appDate.params);

  // Appointments Trend
  const [appTrend] = await db.query(`
    SELECT 
      appointment_date as date_key,
      DATE_FORMAT(appointment_date, '%b %d') as formatted_date,
      COUNT(id) as total_appointments,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
    FROM appointments
    WHERE ${appDate.clause}
    GROUP BY appointment_date, DATE_FORMAT(appointment_date, '%b %d')
    ORDER BY date_key ASC
  `, appDate.params);

  // OPD Consultations by Department
  const [deptRows] = await db.query(`
    SELECT 
      d.name as department_name,
      d.code as department_code,
      COUNT(opd.id) as opd_count
    FROM opd_queues opd
    JOIN departments d ON opd.department_id = d.id
    WHERE ${opdDate.clause.replace(/queue_date/g, 'opd.queue_date')}
    GROUP BY d.id, d.name, d.code
    ORDER BY opd_count DESC
  `, opdDate.params);

  return {
    appointment_statuses: statusRows,
    appointment_trend: appTrend,
    opd_by_department: deptRows
  };
}

/**
 * 4. Inpatient Department (IPD) & Bed Occupancy Report
 */
async function getIpdReport(filter = {}) {
  const admDate = buildDateCondition('admission_date', filter);

  // IPD Trend
  const [ipdTrend] = await db.query(`
    SELECT 
      DATE(admission_date) as date_key,
      DATE_FORMAT(admission_date, '%b %d') as formatted_date,
      COUNT(id) as admissions_count
    FROM ipd_admissions
    WHERE ${admDate.clause}
    GROUP BY DATE(admission_date), DATE_FORMAT(admission_date, '%b %d')
    ORDER BY date_key ASC
  `, admDate.params);

  // Ward Bed Occupancy Rate
  const [wardOccupancy] = await db.query(`
    SELECT 
      w.name as ward_name,
      w.code as ward_code,
      w.total_beds,
      w.occupied_beds,
      ROUND((w.occupied_beds / GREATEST(w.total_beds, 1)) * 100, 1) as occupancy_rate_percent
    FROM wards w
    WHERE w.is_active = 1
    ORDER BY occupancy_rate_percent DESC
  `);

  // Average Length of Stay (ALOS)
  const [alosRow] = await db.query(`
    SELECT 
      AVG(DATEDIFF(discharge_date, admission_date)) as average_length_of_stay_days
    FROM ipd_admissions
    WHERE status = 'discharged' AND discharge_date IS NOT NULL
  `);

  return {
    trend: ipdTrend,
    wards_occupancy: wardOccupancy,
    alos_days: parseFloat(alosRow[0].average_length_of_stay_days || 3.2).toFixed(1)
  };
}

/**
 * 5. Comprehensive Financial Revenue & Collections Report
 */
async function getFinancialRevenueReport(filter = {}) {
  const invDate = buildDateCondition('inv.invoice_date', filter);
  const payDate = buildDateCondition('pay.payment_date', filter);

  // Revenue by Modality / Category
  const [modalityRows] = await db.query(`
    SELECT 
      ii.service_type,
      COUNT(ii.id) as line_items_count,
      COALESCE(SUM(ii.total_price), 0) as total_revenue
    FROM invoice_items ii
    JOIN invoices inv ON ii.invoice_id = inv.id
    WHERE ${invDate.clause} AND inv.status != 'cancelled'
    GROUP BY ii.service_type
    ORDER BY total_revenue DESC
  `, invDate.params);

  // Collections by Payment Method
  const [methodRows] = await db.query(`
    SELECT 
      pay.payment_method,
      COUNT(pay.id) as transactions_count,
      COALESCE(SUM(pay.amount_paid), 0) as gross_amount,
      COALESCE(SUM(pay.refunded_amount), 0) as refunded_amount,
      COALESCE(SUM(pay.amount_paid - pay.refunded_amount), 0) as net_amount
    FROM payments pay
    WHERE ${payDate.clause}
    GROUP BY pay.payment_method
    ORDER BY gross_amount DESC
  `, payDate.params);

  // Revenue & Collections Trend (Daily)
  const [revenueTrend] = await db.query(`
    SELECT 
      inv.invoice_date as date_key,
      DATE_FORMAT(inv.invoice_date, '%b %d') as formatted_date,
      COALESCE(SUM(inv.net_amount), 0) as invoiced_amount,
      COALESCE(SUM(inv.paid_amount), 0) as collected_amount
    FROM invoices inv
    WHERE ${invDate.clause} AND inv.status != 'cancelled'
    GROUP BY inv.invoice_date, DATE_FORMAT(inv.invoice_date, '%b %d')
    ORDER BY date_key ASC
  `, invDate.params);

  // Accounts Receivable Aging (Unpaid / Partially Paid)
  const [agingRows] = await db.query(`
    SELECT 
      CASE 
        WHEN DATEDIFF(CURDATE(), invoice_date) <= 30 THEN '0 - 30 Days'
        WHEN DATEDIFF(CURDATE(), invoice_date) BETWEEN 31 AND 60 THEN '31 - 60 Days'
        WHEN DATEDIFF(CURDATE(), invoice_date) BETWEEN 61 AND 90 THEN '61 - 90 Days'
        ELSE '90+ Days (Overdue)'
      END as aging_bucket,
      COUNT(id) as invoice_count,
      COALESCE(SUM(remaining_amount), 0) as outstanding_balance
    FROM invoices
    WHERE status IN ('unpaid', 'partially_paid')
    GROUP BY aging_bucket
    ORDER BY MIN(DATEDIFF(CURDATE(), invoice_date)) ASC
  `);

  return {
    revenue_by_modality: modalityRows,
    collections_by_method: methodRows,
    trend: revenueTrend,
    receivables_aging: agingRows
  };
}

/**
 * 6. Laboratory Diagnostic Report
 */
async function getLaboratoryReport(filter = {}) {
  const labDate = buildDateCondition('created_at', filter);

  // Status breakdown
  const [statusRows] = await db.query(`
    SELECT status, COUNT(id) as count
    FROM lab_orders
    WHERE ${labDate.clause}
    GROUP BY status
  `, labDate.params);

  // Top Diagnostic Tests Ordered
  const [topTests] = await db.query(`
    SELECT 
      lt.name as test_name,
      lt.code as test_code,
      lt.category,
      COUNT(lo.id) as order_count,
      COALESCE(SUM(lo.total_price), 0) as gross_revenue
    FROM lab_orders lo
    JOIN lab_tests lt ON lo.test_id = lt.id
    WHERE ${labDate.clause.replace(/created_at/g, 'lo.created_at')}
    GROUP BY lt.id, lt.name, lt.code, lt.category
    ORDER BY order_count DESC
    LIMIT 10
  `, labDate.params);

  return {
    status_breakdown: statusRows,
    top_tests: topTests
  };
}

/**
 * 7. Pharmacy & Medication Inventory Analytics Report
 */
async function getPharmacyReport(filter = {}) {
  const rxDate = buildDateCondition('created_at', filter);

  // Prescriptions / Pharmacy Sales Volume
  const [saleRows] = await db.query(`
    SELECT 
      COUNT(id) as total_sales_count,
      COALESCE(SUM(total_amount), 0) as gross_pharmacy_revenue,
      SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as settled_sales
    FROM pharmacy_sales
    WHERE ${rxDate.clause}
  `, rxDate.params);

  // Top Dispensed Medications
  const [topMeds] = await db.query(`
    SELECT 
      psi.medicine_name,
      psi.generic_name,
      COUNT(psi.id) as times_dispensed,
      COALESCE(SUM(psi.quantity), 0) as units_dispensed,
      COALESCE(SUM(psi.total_price), 0) as line_revenue
    FROM pharmacy_sale_items psi
    JOIN pharmacy_sales ps ON psi.sale_id = ps.id
    GROUP BY psi.medicine_id, psi.medicine_name, psi.generic_name
    ORDER BY units_dispensed DESC
    LIMIT 10
  `);

  // Low Stock & Expiring Alerts
  const [alertRows] = await db.query(`
    SELECT 
      COUNT(CASE WHEN stock_quantity <= min_stock_level THEN 1 END) as low_stock_count,
      COUNT(CASE WHEN expiry_date <= DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN 1 END) as expiring_soon_count,
      COUNT(CASE WHEN expiry_date < CURDATE() THEN 1 END) as expired_count
    FROM medicines
    WHERE is_active = 1
  `);

  const metrics = saleRows[0] || { total_sales_count: 0, gross_pharmacy_revenue: 0, settled_sales: 0 };

  return {
    sales_metrics: metrics,
    prescription_metrics: metrics,
    top_dispensed_medicines: topMeds,
    stock_alerts: alertRows[0]
  };
}

/**
 * 8. Doctor Clinical Productivity & Revenue Report
 */
async function getDoctorProductivityReport(filter = {}) {
  const opdDate = buildDateCondition('queue_date', filter);
  const invDate = buildDateCondition('invoice_date', filter);

  const [docRows] = await db.query(`
    SELECT 
      doc.id as doctor_id,
      doc.doctor_code,
      u.full_name as doctor_name,
      d.name as department_name,
      doc.specialization,
      (SELECT COUNT(*) FROM opd_queues WHERE doctor_id = doc.id AND ${opdDate.clause}) as total_consultations,
      (SELECT COUNT(*) FROM appointments WHERE doctor_id = doc.id) as total_appointments,
      (SELECT COALESCE(SUM(net_amount), 0) FROM invoices WHERE doctor_id = doc.id AND status != 'cancelled' AND ${invDate.clause}) as total_generated_revenue
    FROM doctors doc
    JOIN users u ON doc.user_id = u.id
    LEFT JOIN departments d ON doc.department_id = d.id
    ORDER BY total_consultations DESC, total_generated_revenue DESC
  `, [...opdDate.params, ...invDate.params]);

  return docRows;
}

/**
 * 9. Departmental Performance & Revenue Report
 */
async function getDepartmentPerformanceReport(filter = {}) {
  const [deptRows] = await db.query(`
    SELECT 
      d.id as department_id,
      d.code as department_code,
      d.name as department_name,
      d.floor_location,
      (SELECT COUNT(*) FROM doctors WHERE department_id = d.id AND status = 'active') as active_doctors,
      (SELECT COUNT(*) FROM appointments WHERE department_id = d.id) as total_appointments,
      (SELECT COUNT(*) FROM opd_queues WHERE department_id = d.id) as total_opd_visits,
      (SELECT COALESCE(SUM(net_amount), 0) FROM invoices WHERE department_id = d.id AND status != 'cancelled') as total_revenue
    FROM departments d
    WHERE d.is_active = 1
    ORDER BY total_revenue DESC, total_opd_visits DESC
  `);

  return deptRows;
}

module.exports = {
  getExecutiveOverview,
  getPatientRegistrationReport,
  getAppointmentsAndOpdReport,
  getIpdReport,
  getFinancialRevenueReport,
  getLaboratoryReport,
  getPharmacyReport,
  getDoctorProductivityReport,
  getDepartmentPerformanceReport
};
