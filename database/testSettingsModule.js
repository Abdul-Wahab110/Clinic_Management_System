const settingsService = require('../server/services/settings.service');
const db = require('../server/config/db');

async function runSettingsIntegrationTests() {
  console.log('🧪 Starting Hospital Settings Module Integration Tests...\n');
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      testsFailed++;
    }
  }

  try {
    const adminUser = { id: 1, name: 'Dr. Administrator', role: 'super_admin' };

    // Test Suite 1: Public Settings Retrieval
    console.log('--- Test Suite 1: Public Settings Retrieval ---');
    const pubSettings = await settingsService.getPublicSettings();
    assert(pubSettings.hasOwnProperty('hospital_name'), 'Public settings contains hospital_name');
    assert(pubSettings.hasOwnProperty('phone'), 'Public settings contains phone');
    assert(pubSettings.hasOwnProperty('email'), 'Public settings contains email');
    assert(pubSettings.hasOwnProperty('emergency_number'), 'Public settings contains emergency_number');
    assert(pubSettings.hasOwnProperty('currency_symbol'), 'Public settings contains currency_symbol');
    assert(pubSettings.hasOwnProperty('opening_hours'), 'Public settings contains opening_hours');
    assert(!pubSettings.hasOwnProperty('invoice_prefix'), 'Public settings excludes sensitive billing prefix');

    // Test Suite 2: Admin All Settings Retrieval
    console.log('\n--- Test Suite 2: Admin All Settings Retrieval ---');
    const adminSettings = await settingsService.getAllSettings();
    assert(adminSettings.id === 1, 'Fetches primary hospital settings record ID 1');
    assert(adminSettings.hasOwnProperty('invoice_prefix'), 'Admin settings includes invoice_prefix');
    assert(adminSettings.hasOwnProperty('patient_prefix'), 'Admin settings includes patient_prefix');
    assert(adminSettings.hasOwnProperty('appointment_duration_minutes'), 'Admin settings includes appointment_duration_minutes');
    assert(adminSettings.hasOwnProperty('email_notifications_enabled'), 'Admin settings includes email_notifications_enabled');
    assert(adminSettings.hasOwnProperty('low_stock_alerts_enabled'), 'Admin settings includes low_stock_alerts_enabled');

    // Test Suite 3: Updating Hospital Settings & Persistence
    console.log('\n--- Test Suite 3: Updating Hospital Settings & Persistence ---');
    const updateResult = await settingsService.updateSettings({
      hospital_name: 'AuraCare Medical Center & Super Specialty Institute',
      hospital_tagline: 'Excellence in Comprehensive Healthcare & Specialized Medicine',
      phone: '+1 (800) 555-2273',
      emergency_number: '+1 (800) 911-2872',
      appointment_duration_minutes: 45,
      invoice_prefix: 'INV-2026-',
      patient_prefix: 'PAT-2026-',
      currency_code: 'USD',
      currency_symbol: '$',
      allow_online_booking: 1
    }, adminUser);

    assert(updateResult.hospital_name === 'AuraCare Medical Center & Super Specialty Institute', 'Hospital name updated');
    assert(updateResult.phone === '+1 (800) 555-2273', 'Hospital phone updated');
    assert(updateResult.emergency_number === '+1 (800) 911-2872', 'Emergency hotline updated');
    assert(updateResult.appointment_duration_minutes === 45, 'Appointment duration updated to 45 mins');
    assert(updateResult.updated_by === 1, 'Updated_by admin ID recorded in MySQL');

    // Verify in MySQL
    const [dbRows] = await db.query('SELECT phone, emergency_number, appointment_duration_minutes FROM hospital_settings WHERE id = 1');
    assert(dbRows[0].phone === '+1 (800) 555-2273', 'Phone persisted in MySQL');
    assert(dbRows[0].appointment_duration_minutes === 45, 'Duration persisted in MySQL');

    // Test Suite 4: Audit Trail Logging
    console.log('\n--- Test Suite 4: Audit Trail Logging ---');
    const [auditRows] = await db.query(
      "SELECT * FROM audit_logs WHERE module = 'SETTINGS' OR entity = 'settings' ORDER BY id DESC LIMIT 1"
    );
    assert(auditRows.length > 0, 'Settings update recorded in audit_logs table');
    assert(auditRows[0].action === 'UPDATE', 'Audit action recorded as UPDATE');
    assert(auditRows[0].user_id === 1, 'Audit user_id matches admin');

    console.log('\n======================================================');
    console.log(`🏁 SETTINGS MODULE INTEGRATION TEST RESULTS:`);
    console.log(`   Passed: ${testsPassed}`);
    console.log(`   Failed: ${testsFailed}`);
    console.log('======================================================\n');

    if (testsFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Test execution error:', err);
    process.exit(1);
  }
}

runSettingsIntegrationTests();
