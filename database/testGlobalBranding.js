const http = require('http');
const { pool } = require('../server/config/db');

const TEST_PORT = parseInt(process.env.PORT || '5000', 10);

function sendReq(method, path, payload = null, token = null) {
  return new Promise((resolve) => {
    const postData = payload ? JSON.stringify(payload) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: path,
      method: method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => resolve({ error: err.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runGlobalBrandingTest() {
  console.log('====================================================');
  console.log('🌐 TESTING GLOBAL BRANDING & HOSPITAL SETTINGS');
  console.log('====================================================\n');

  // 1. Fetch Initial Public Settings
  console.log('--- 1. Fetching Public Settings ---');
  const initialRes = await sendReq('GET', '/api/v1/settings/public');
  assert(initialRes.status === 200, 'Public settings retrieved with HTTP 200');
  assert(!!initialRes.data.data.hospital_name, `Current hospital name: "${initialRes.data.data.hospital_name}"`);

  // 2. Authenticate Super Admin
  console.log('\n--- 2. Authenticating Super Admin ---');
  const loginRes = await sendReq('POST', '/api/v1/auth/login', {
    email: 'superadmin@auracare.com',
    password: 'Clinic2026!'
  });
  assert(loginRes.status === 200, 'Super Admin logged in');
  const token = loginRes.data.data.token;

  // 3. Update Hospital Settings via Admin API
  console.log('\n--- 3. Updating Hospital Branding via PUT /settings ---');
  const updatePayload = {
    hospital_name: 'AuraCare Premier Healthcare Pavilion',
    hospital_tagline: 'World-Class Clinical Precision & Advanced Therapeutics',
    phone: '+1 (800) 777-AURA',
    email: 'contact@auracare-premier.org',
    address: '900 Medical Excellence Boulevard, New York, NY 10021',
    emergency_number: '+1 (800) 999-EMERGENCY',
    opening_hours: '24 Hours Everyday'
  };

  const updateRes = await sendReq('PUT', '/api/v1/settings', updatePayload, token);
  assert(updateRes.status === 200, 'Hospital settings updated via PUT /settings');

  // 4. Verify Immediate Dynamic Reflection on Public Endpoint
  console.log('\n--- 4. Verifying Immediate Global Ingestion ---');
  const publicRes = await sendReq('GET', '/api/v1/settings/public');
  assert(publicRes.data.data.hospital_name === 'AuraCare Premier Healthcare Pavilion', 'Public endpoint immediately reflects updated hospital name');
  assert(publicRes.data.data.phone === '+1 (800) 777-AURA', 'Public endpoint reflects updated phone');
  assert(publicRes.data.data.emergency_number === '+1 (800) 999-EMERGENCY', 'Public endpoint reflects updated emergency number');

  // 5. Verify MySQL Persistence
  console.log('\n--- 5. Verifying MySQL Persistence in hospital_settings Table ---');
  const [[dbSettings]] = await pool.query('SELECT * FROM hospital_settings LIMIT 1');
  assert(dbSettings.hospital_name === 'AuraCare Premier Healthcare Pavilion', 'MySQL database persisted hospital_name');
  assert(dbSettings.emergency_number === '+1 (800) 999-EMERGENCY', 'MySQL database persisted emergency_number');

  // 6. Restore Default Settings
  console.log('\n--- 6. Restoring Default Settings ---');
  await sendReq('PUT', '/api/v1/settings', {
    hospital_name: 'AuraCare Medical Center',
    hospital_tagline: 'Excellence in Comprehensive Healthcare & Specialized Medicine',
    phone: '+1 (800) 555-CARE',
    email: 'concierge@auracare.org',
    address: '742 Evergreen Healthcare Pavilion, Medical District, NY 10001',
    emergency_number: '+1 (800) 911-AURA',
    opening_hours: 'Mon - Sat: 08:00 AM - 08:00 PM | Emergency 24/7'
  }, token);

  const [[restoredDb]] = await pool.query('SELECT hospital_name FROM hospital_settings LIMIT 1');
  assert(restoredDb.hospital_name === 'AuraCare Medical Center', 'Default hospital name restored in MySQL');

  console.log('\n====================================================');
  console.log('🏁 ALL GLOBAL BRANDING TESTS PASSED (0 FAILURES)');
  console.log('====================================================\n');
  process.exit(0);
}

runGlobalBrandingTest().catch(e => {
  console.error(e);
  process.exit(1);
});
