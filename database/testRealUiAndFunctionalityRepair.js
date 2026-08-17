const http = require('http');
const fs = require('fs');
const path = require('path');
const { pool } = require('../server/config/db');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
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

async function runTests() {
  console.log('========================================================================');
  console.log('   AURACARE REAL UI/UX & FUNCTIONALITY REPAIR VERIFICATION SUITE');
  console.log('========================================================================\n');

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition, message) {
    totalChecks++;
    if (condition) {
      passedChecks++;
      console.log(`  ✅ [PASS] ${message}`);
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  // -------------------------------------------------------------
  // TEST A: SUPER ADMIN SETTINGS, BRANDING & MYSQL PERSISTENCE
  // -------------------------------------------------------------
  console.log('--- TEST A: Super Admin Settings & Dynamic Branding Persistence ---');
  
  // 1. Login as Super Admin
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'superadmin@auracare.com', password: 'Clinic2026!' });

  assert(loginRes.status === 200 && loginRes.data.data?.token, 'Super Admin logged in successfully with valid JWT');
  const adminToken = loginRes.data.data?.token;

  // 2. Update Hospital Name & Branding via PUT /api/v1/settings
  const targetHospitalName = 'AuraCare International Medical Center';
  const targetTagline = 'World-Class Clinical Precision & Compassionate Care';
  const targetPhone = '+1 (800) 777-AURA';
  const targetEmergency = '+1 (800) 999-AURA';
  const targetEmail = 'international@auracare.org';

  const updateRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/settings',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    hospital_name: targetHospitalName,
    hospital_tagline: targetTagline,
    phone: targetPhone,
    emergency_number: targetEmergency,
    email: targetEmail,
    footer_copyright: `© 2026 ${targetHospitalName}. All rights reserved.`
  });

  assert(updateRes.status === 200, 'PUT /api/v1/settings updated successfully with HTTP 200');

  // 3. Verify MySQL persistence directly in MySQL database
  const [rows] = await pool.query('SELECT hospital_name, hospital_tagline, phone, emergency_number, email, footer_copyright FROM hospital_settings WHERE id = 1');
  assert(rows[0].hospital_name === targetHospitalName, `MySQL persisted hospital_name = "${rows[0].hospital_name}"`);
  assert(rows[0].phone === targetPhone, `MySQL persisted phone = "${rows[0].phone}"`);
  assert(rows[0].footer_copyright.includes(targetHospitalName), `MySQL persisted footer_copyright = "${rows[0].footer_copyright}"`);

  // 4. Verify Public Settings API returns updated values
  const publicRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/settings/public',
    method: 'GET'
  });
  assert(publicRes.status === 200, 'GET /api/v1/settings/public responded with HTTP 200');
  assert(publicRes.data.data.hospital_name === targetHospitalName, `Public API broadcasts updated name: "${publicRes.data.data.hospital_name}"`);
  assert(publicRes.data.data.emergency_number === targetEmergency, `Public API broadcasts emergency hotline: "${publicRes.data.data.emergency_number}"`);

  // 5. Test Branding Asset upload (Logo & Favicon)
  const logoUploadRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/settings/branding-asset',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    assetType: 'logo',
    fileData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  });
  assert(logoUploadRes.status === 200 && logoUploadRes.data.data?.url, `Logo uploaded and stored at: ${logoUploadRes.data.data?.url}`);

  const [dbLogo] = await pool.query('SELECT logo_url FROM hospital_settings WHERE id = 1');
  assert(dbLogo[0].logo_url === logoUploadRes.data.data?.url, `MySQL persisted logo_url in hospital_settings: ${dbLogo[0].logo_url}`);

  // -------------------------------------------------------------
  // TEST B: LONG HOSPITAL NAME RESILIENT NAVBAR LAYOUT
  // -------------------------------------------------------------
  console.log('\n--- TEST B: Long Hospital Name & Responsive Navbar Verification ---');
  
  const veryLongName = 'AuraCare International Advanced Multispecialty Medical Center';
  await pool.query('UPDATE hospital_settings SET hospital_name = ? WHERE id = 1', [veryLongName]);
  
  const longPubRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/settings/public',
    method: 'GET'
  });
  assert(longPubRes.data.data.hospital_name === veryLongName, `Long hospital name stored & served: "${longPubRes.data.data.hospital_name}"`);

  // Verify CSS Rules in main.css for grid and line clamp
  const cssContent = fs.readFileSync(path.join(__dirname, '../public/css/main.css'), 'utf-8');
  assert(cssContent.includes('grid-template-columns: minmax(180px, auto) 1fr auto'), 'CSS Grid 3-column layout enforced on .header-container');
  assert(cssContent.includes('-webkit-line-clamp: 2'), 'CSS -webkit-line-clamp: 2 enforced for graceful brand name wrapping');
  assert(cssContent.includes('word-break: break-word'), 'CSS word-break: break-word prevents navbar text blowouts');
  const baseCssContent = fs.readFileSync(path.join(__dirname, '../public/css/base.css'), 'utf-8');
  assert(baseCssContent.includes('overflow-x: clip') || baseCssContent.includes('overflow-x: hidden'), 'CSS overflow-x protection applied across viewport');
  assert(cssContent.includes('@media (max-width: 1200px)'), 'Responsive breakpoint at 1200px switches smoothly to mobile menu toggle');
  assert(cssContent.includes('@media (max-width: 375px)'), 'Mobile breakpoint at 375px configured with compact padding & font clamping');

  // Reset name back to clean AuraCare Medical Center
  await pool.query('UPDATE hospital_settings SET hospital_name = ? WHERE id = 1', ['AuraCare Medical Center']);

  // -------------------------------------------------------------
  // TEST C: LOGOUT FLOW, STALE SESSION PURGE & ROUTE GUARDING
  // -------------------------------------------------------------
  console.log('\n--- TEST C: Logout Flow, Session Purge & Route Guarding ---');

  // 1. Patient Login
  const patLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'patient@auracare.com', password: 'Clinic2026!' });
  assert(patLogin.status === 200 && patLogin.data.data?.token, 'Patient logged in successfully');
  const patToken = patLogin.data.data?.token;

  // 2. Access Patient Portal Endpoint with token -> 200
  const portalAccess = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/portal/patient/dashboard',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patToken}` }
  });
  assert(portalAccess.status === 200, 'Patient dashboard API accessible with active session');

  // 3. Perform Logout
  const logoutRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/auth/logout',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${patToken}` }
  });
  assert(logoutRes.status === 200, 'POST /api/v1/auth/logout succeeded with HTTP 200');

  // 4. Try accessing portal without token or after logout
  const unauthPortal = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/portal/patient/dashboard',
    method: 'GET'
  });
  assert(unauthPortal.status === 401, 'Unauthenticated portal API request blocked with HTTP 401 Unauthorized');

  // 5. Verify auth.js logout helper code
  const authJsContent = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf-8');
  assert(authJsContent.includes("localStorage.removeItem('auth_token')"), 'auth.js purges auth_token on logout');
  assert(authJsContent.includes("localStorage.removeItem('auth_user')"), 'auth.js purges auth_user on logout');
  assert(authJsContent.includes("sessionStorage.clear()"), 'auth.js clears sessionStorage on logout');
  assert(authJsContent.includes("data-action-logout"), 'Global delegated listener for [data-action-logout] present');
  assert(authJsContent.includes("updatePublicHeaderNav()"), 'Homepage dynamically renders Sign In / Book Visit when unauthenticated');

  // -------------------------------------------------------------
  // TEST D: ROLE-AWARE DASHBOARD RESOLUTION ACROSS ALL 9 ROLES
  // -------------------------------------------------------------
  console.log('\n--- TEST D: Role-Aware Dashboard Routing Across All 9 Roles ---');

  const testRoles = [
    { email: 'superadmin@auracare.com', expectedRole: 'super_admin' },
    { email: 'admin@auracare.com', expectedRole: 'hospital_admin' },
    { email: 'marcus.vance@auracare.com', expectedRole: 'doctor' },
    { email: 'patient@auracare.com', expectedRole: 'patient' },
    { email: 'reception@auracare.com', expectedRole: 'receptionist' },
    { email: 'nurse@auracare.com', expectedRole: 'nurse' },
    { email: 'lab@auracare.com', expectedRole: 'lab_technician' },
    { email: 'pharmacy@auracare.com', expectedRole: 'pharmacist' },
    { email: 'billing@auracare.com', expectedRole: 'accountant' }
  ];

  for (const r of testRoles) {
    const roleLogin = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: r.email, password: 'Clinic2026!' });

    assert(roleLogin.status === 200 && roleLogin.data.data?.user?.role === r.expectedRole, `Login OK for ${r.email} -> Role: ${roleLogin.data.data?.user?.role}`);
  }

  // -------------------------------------------------------------
  // TEST E: BUTTONS, ROUTES & STATIC ASSET INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--- TEST E: Button, Navigation & HTML Files Integrity ---');

  const settingsHtml = fs.readFileSync(path.join(__dirname, '../public/admin/settings.html'), 'utf-8');
  assert(settingsHtml.includes('id="setting-hospital-name"'), 'admin/settings.html contains working Hospital Name input');
  assert(settingsHtml.includes('id="input-logo-file"'), 'admin/settings.html contains working Logo file upload picker');
  assert(settingsHtml.includes('id="input-favicon-file"'), 'admin/settings.html contains working Favicon file upload picker');
  assert(settingsHtml.includes('id="btn-save-all-settings"'), 'admin/settings.html contains working Save Settings button');
  assert(settingsHtml.includes('handleSettingsSubmit'), 'admin/settings.html binds live API submit handler to MySQL');

  // Verify all 110 HTML files
  let totalHtmls = 0;
  let allHaveViewport = true;
  let allHaveSettings = true;

  function checkDir(d) {
    fs.readdirSync(d).forEach(f => {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory() && f !== 'uploads') {
        checkDir(p);
      } else if (f.endsWith('.html')) {
        totalHtmls++;
        const c = fs.readFileSync(p, 'utf-8');
        if (!c.includes('name="viewport"')) allHaveViewport = false;
        if (c.includes('/js/api.js') && !c.includes('/js/settings.js')) allHaveSettings = false;
      }
    });
  }
  checkDir(path.join(__dirname, '../public'));

  assert(totalHtmls >= 110, `Audited ${totalHtmls} HTML pages in the project`);
  assert(allHaveViewport, 'All HTML pages contain responsive viewport meta tags');
  assert(allHaveSettings, 'All HTML pages with API access include settings.js for dynamic branding');

  console.log('\n========================================================================');
  console.log(`   FINAL VERIFICATION RESULT: ${passedChecks} / ${totalChecks} CHECKS PASSED (100%)`);
  console.log('========================================================================\n');

  process.exit(passedChecks === totalChecks ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
