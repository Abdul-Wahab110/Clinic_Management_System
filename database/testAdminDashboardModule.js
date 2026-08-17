const http = require('http');

const PORT = parseInt(process.env.PORT || '5000', 10);
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

let adminToken = '';
let patientToken = '';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function parseUrl(endpoint) {
  const url = new URL(BASE_URL + endpoint);
  return {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search
  };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exitCode = 1;
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ PASS: ${message}`);
  }
}

async function runTests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 COMPREHENSIVE TEST SUITE: ADMIN DASHBOARD & ANALYTICS');
  console.log('🧪 ========================================================\n');

  // Step 1: Authenticate Super Admin Account
  console.log('--- 1. Authenticating Super Admin Account ---');
  const loginRes = await request({
    ...parseUrl('/auth/login'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@auracare.com', password: 'Clinic2026!' });

  assert(loginRes.status === 200, 'Super Admin login returned HTTP 200');
  assert(loginRes.data.success === true, 'Admin login successful');
  adminToken = loginRes.data.data.token;
  assert(!!adminToken, 'JWT token acquired for authenticated administrator');

  // Step 2: Fetch Live Admin Dashboard Stats (GET /admin/dashboard-stats)
  console.log('\n--- 2. Testing Admin Dashboard Analytics API (GET /admin/dashboard-stats) ---');
  const statsRes = await request({
    ...parseUrl('/admin/dashboard-stats'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  assert(statsRes.status === 200, 'GET /admin/dashboard-stats returned HTTP 200');
  assert(statsRes.data.success === true, 'Response status is success');

  const d = statsRes.data.data;
  assert(!!d.cards, 'Dashboard 9 KPI Cards object present');
  assert(!!d.analytics, 'Dashboard 6 Analytics series object present');

  // Step 3: Verify All 9 KPI Cards Computed from MySQL
  console.log('\n--- 3. Verifying All 9 Dashboard KPI Metric Cards ---');
  const c = d.cards;

  // 1. Total Patients
  assert(typeof c.total_patients.count === 'number', `1. Total Patients: ${c.total_patients.count} (New 30d: ${c.total_patients.new_last_30_days})`);
  // 2. Today's Appointments
  assert(typeof c.today_appointments.count === 'number', `2. Today Appointments: ${c.today_appointments.count} (Completed: ${c.today_appointments.completed})`);
  // 3. Today's Revenue
  assert(typeof c.today_revenue.collected === 'number', `3. Today Revenue Collected: $${c.today_revenue.collected.toFixed(2)}`);
  // 4. Doctors
  assert(typeof c.doctors.total === 'number' && c.doctors.total >= 0, `4. Total Doctors: ${c.doctors.total} (Active: ${c.doctors.active})`);
  // 5. Staff
  assert(typeof c.staff.total === 'number' && c.staff.total >= 0, `5. Total Staff: ${c.staff.total} (Active: ${c.staff.active})`);
  // 6. Available Beds
  assert(typeof c.available_beds.total === 'number', `6. IPD Beds: ${c.available_beds.available} Available / ${c.available_beds.total} Total (${c.available_beds.occupancy_rate_percent}% Occupancy)`);
  // 7. Pending Bills
  assert(typeof c.pending_bills.count === 'number', `7. Pending Bills: ${c.pending_bills.count} Invoices ($${c.pending_bills.total_outstanding_amount.toFixed(2)} Due)`);
  // 8. Lab Orders
  assert(typeof c.lab_orders.total === 'number', `8. Lab Orders: ${c.lab_orders.total} Total (${c.lab_orders.orders_today} Today, ${c.lab_orders.pending} Pending)`);
  // 9. Low Stock Items
  assert(typeof c.low_stock_items.total === 'number', `9. Low Stock Items: ${c.low_stock_items.total} (${c.low_stock_items.medicines} Meds, ${c.low_stock_items.inventory} Consumables)`);

  // Step 4: Verify All 6 Analytics Data Series Computed from MySQL
  console.log('\n--- 4. Verifying All 6 Advanced Analytics Data Series ---');
  const a = d.analytics;

  // 1. Patient Growth
  assert(Array.isArray(a.patient_growth), '1. Patient Growth series is an array');
  console.log(`     Data points: ${a.patient_growth.length} monthly registration periods`);

  // 2. Appointment Trends
  assert(Array.isArray(a.appointment_trends), '2. Appointment Trends series is an array');
  console.log(`     Data points: ${a.appointment_trends.length} monthly appointment periods`);

  // 3. Revenue Trends
  assert(Array.isArray(a.revenue_trends), '3. Revenue Trends series is an array');
  console.log(`     Data points: ${a.revenue_trends.length} monthly financial periods`);

  // 4. Department Performance
  assert(Array.isArray(a.department_performance), '4. Department Performance series is an array');
  console.log(`     Departments evaluated: ${a.department_performance.length}`);

  // 5. Lab Activity
  assert(!!a.lab_activity && Array.isArray(a.lab_activity.categories), '5. Lab Activity contains category breakdown array');
  assert(Array.isArray(a.lab_activity.status_breakdown), '   Lab Activity contains status breakdown array');

  // 6. Pharmacy Activity
  assert(!!a.pharmacy_activity && Array.isArray(a.pharmacy_activity.monthly), '6. Pharmacy Activity contains monthly fulfillment trends');
  assert(Array.isArray(a.pharmacy_activity.top_medicines), '   Pharmacy Activity contains top dispensed medications list');

  // Step 5: Test Role Access Security Control
  console.log('\n--- 5. Testing RBAC Security Permissions Guard ---');
  const patLogin = await request({
    ...parseUrl('/auth/login'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'patient@auracare.com', password: 'Clinic2026!' });

  patientToken = patLogin.data.data.token;

  const forbiddenRes = await request({
    ...parseUrl('/admin/dashboard-stats'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(forbiddenRes.status === 403, 'Patient account receives HTTP 403 Forbidden on Admin Dashboard Stats');

  console.log('\n======================================================');
  console.log('🏁 ALL ADMIN DASHBOARD TESTS PASSED SUCCESSFULLY (0 FAILURES)');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed with Error:\n', err);
  process.exit(1);
});
