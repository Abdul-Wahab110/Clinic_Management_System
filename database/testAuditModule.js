const auditService = require('../server/services/audit.service');
const db = require('../server/config/db');

async function runAuditIntegrationTests() {
  console.log('🧪 Starting Security Audit Logging Module Integration Tests...\n');
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
    // Test Suite 1: Recording Audit Events Across 11 Required Modalities
    console.log('--- Test Suite 1: Recording Audit Events Across 11 Required Modalities ---');
    
    // 1. LOGIN
    const evLogin = await auditService.logAuditEvent({
      user_id: 1, user_name: 'Dr. Administrator', user_role: 'super_admin',
      action: 'LOGIN', module: 'AUTH', record_id: '1', ip_address: '192.168.1.100',
      description: 'Super Administrator signed in with multi-factor authentication.',
      details_json: { ip: '192.168.1.100', auth_type: 'jwt' }
    });
    assert(evLogin.id !== undefined && evLogin.action === 'LOGIN', '1. Tracked LOGIN action');

    // 2. LOGOUT
    const evLogout = await auditService.logAuditEvent({
      user_id: 3, user_name: 'Dr. Marcus Vance', user_role: 'doctor',
      action: 'LOGOUT', module: 'AUTH', record_id: '3', ip_address: '192.168.1.105',
      description: 'Doctor Marcus Vance logged out of clinical station.'
    });
    assert(evLogout.id !== undefined && evLogout.action === 'LOGOUT', '2. Tracked LOGOUT action');

    // 3. CREATE
    const evCreate = await auditService.logAuditEvent({
      user_id: 5, user_name: 'Sarah Jenkins', user_role: 'receptionist',
      action: 'CREATE', module: 'PATIENTS', record_id: '10', ip_address: '192.168.1.110',
      description: 'Created patient record for Jane Doe.'
    });
    assert(evCreate.id !== undefined && evCreate.action === 'CREATE', '3. Tracked CREATE action');

    // 4. UPDATE
    const evUpdate = await auditService.logAuditEvent({
      user_id: 3, user_name: 'Dr. Marcus Vance', user_role: 'doctor',
      action: 'UPDATE', module: 'APPOINTMENTS', record_id: '1', ip_address: '192.168.1.105',
      description: 'Rescheduled cardiology consultation appointment #1.'
    });
    assert(evUpdate.id !== undefined && evUpdate.action === 'UPDATE', '4. Tracked UPDATE action');

    // 5. DELETE
    const evDelete = await auditService.logAuditEvent({
      user_id: 1, user_name: 'Dr. Administrator', user_role: 'super_admin',
      action: 'DELETE', module: 'STAFF', record_id: '88', ip_address: '192.168.1.100',
      description: 'Removed temporary staff profile ID #88.'
    });
    assert(evDelete.id !== undefined && evDelete.action === 'DELETE', '5. Tracked DELETE action');

    // 6. MEDICAL_RECORD_ACCESS
    const evEmr = await auditService.logAuditEvent({
      user_id: 3, user_name: 'Dr. Marcus Vance', user_role: 'doctor',
      action: 'MEDICAL_RECORD_ACCESS', module: 'EMR', record_id: '1', ip_address: '192.168.1.105',
      description: 'Viewed ECG diagnostics and longitudinal vitals for Patient Arthur Pendleton.',
      details_json: { patient_id: 1, view: 'full_chart' }
    });
    assert(evEmr.id !== undefined && evEmr.action === 'MEDICAL_RECORD_ACCESS', '6. Tracked MEDICAL_RECORD_ACCESS action');

    // 7. PRESCRIPTION_CHANGE
    const evRx = await auditService.logAuditEvent({
      user_id: 3, user_name: 'Dr. Marcus Vance', user_role: 'doctor',
      action: 'PRESCRIPTION_CHANGE', module: 'PRESCRIPTIONS', record_id: '1', ip_address: '192.168.1.105',
      description: 'Modified dosage of Lisinopril from 10mg to 20mg.'
    });
    assert(evRx.id !== undefined && evRx.action === 'PRESCRIPTION_CHANGE', '7. Tracked PRESCRIPTION_CHANGE action');

    // 8. BILLING_CHANGE
    const evBill = await auditService.logAuditEvent({
      user_id: 9, user_name: 'Accountant David Miller', user_role: 'accountant',
      action: 'BILLING_CHANGE', module: 'BILLING', record_id: '1', ip_address: '192.168.1.120',
      description: 'Adjusted invoice tax deduction by $20.00 on Invoice #INV-2026-0001.'
    });
    assert(evBill.id !== undefined && evBill.action === 'BILLING_CHANGE', '8. Tracked BILLING_CHANGE action');

    // 9. PAYMENT_CHANGE
    const evPay = await auditService.logAuditEvent({
      user_id: 9, user_name: 'Accountant David Miller', user_role: 'accountant',
      action: 'PAYMENT_CHANGE', module: 'PAYMENTS', record_id: '1', ip_address: '192.168.1.120',
      description: 'Processed payment refund of $50.00.'
    });
    assert(evPay.id !== undefined && evPay.action === 'PAYMENT_CHANGE', '9. Tracked PAYMENT_CHANGE action');

    // 10. PERMISSION_CHANGE
    const evPerm = await auditService.logAuditEvent({
      user_id: 1, user_name: 'Dr. Administrator', user_role: 'super_admin',
      action: 'PERMISSION_CHANGE', module: 'SECURITY', record_id: '2', ip_address: '192.168.1.100',
      description: 'Updated role permissions for role hospital_admin.'
    });
    assert(evPerm.id !== undefined && evPerm.action === 'PERMISSION_CHANGE', '10. Tracked PERMISSION_CHANGE action');

    // 11. ACCOUNT_STATUS_CHANGE
    const evAcc = await auditService.logAuditEvent({
      user_id: 1, user_name: 'Dr. Administrator', user_role: 'super_admin',
      action: 'ACCOUNT_STATUS_CHANGE', module: 'USERS', record_id: '4', ip_address: '192.168.1.100',
      description: 'Deactivated staff account for scheduled audit review.'
    });
    assert(evAcc.id !== undefined && evAcc.action === 'ACCOUNT_STATUS_CHANGE', '11. Tracked ACCOUNT_STATUS_CHANGE action');

    // Test Suite 2: Multi-Criteria Filtering & Search
    console.log('\n--- Test Suite 2: Multi-Criteria Filtering & Search ---');
    const allLogs = await auditService.listAuditLogs({ page: 1, limit: 20 });
    assert(allLogs.logs.length >= 11, 'Retrieves audit logs list from MySQL');
    assert(allLogs.hasOwnProperty('pagination'), 'Includes pagination metadata');
    assert(allLogs.hasOwnProperty('metrics'), 'Includes summary KPI metrics');

    // Filter by Action: MEDICAL_RECORD_ACCESS
    const emrLogs = await auditService.listAuditLogs({ action: 'MEDICAL_RECORD_ACCESS' });
    assert(emrLogs.logs.every(l => l.action === 'MEDICAL_RECORD_ACCESS'), 'Filters audit logs by action');

    // Filter by Module: PRESCRIPTIONS
    const rxLogs = await auditService.listAuditLogs({ module: 'PRESCRIPTIONS' });
    assert(rxLogs.logs.every(l => l.module === 'PRESCRIPTIONS'), 'Filters audit logs by module');

    // Filter by User ID: 1 (Admin)
    const adminLogs = await auditService.listAuditLogs({ user_id: 1 });
    assert(adminLogs.logs.every(l => l.user_id === 1), 'Filters audit logs by user_id');

    // Search by Keyword
    const searchLogs = await auditService.listAuditLogs({ search: 'Lisinopril' });
    assert(searchLogs.logs.length >= 1, 'Search finds audit log by clinical keyword');
    assert(searchLogs.logs[0].description.includes('Lisinopril'), 'Search result contains target description');

    // Test Suite 3: Single Audit Event Metadata & Parsed JSON Inspection
    console.log('\n--- Test Suite 3: Single Audit Event Metadata & Parsed JSON Inspection ---');
    const singleLog = await auditService.getAuditLogById(evEmr.id);
    assert(singleLog.id === evEmr.id, 'Fetches single audit log by ID');
    assert(singleLog.action === 'MEDICAL_RECORD_ACCESS', 'Matches action type');
    assert(singleLog.module === 'EMR', 'Matches module');
    assert(singleLog.user_name && singleLog.user_name.includes('Marcus Vance'), 'Includes actor full name');
    assert(singleLog.parsed_details !== null && singleLog.parsed_details.patient_id === 1, 'Parses details JSON object accurately');

    // Test Suite 4: Analytics & Distribution Statistics
    console.log('\n--- Test Suite 4: Analytics & Distribution Statistics ---');
    const stats = await auditService.getAuditStats();
    assert(stats.hasOwnProperty('action_distribution'), 'Calculates action distribution array');
    assert(stats.hasOwnProperty('module_distribution'), 'Calculates module distribution array');
    assert(stats.action_distribution.length >= 5, 'Includes multiple action distribution categories');

    // Test Suite 5: Immutability & Audit Log Integrity
    console.log('\n--- Test Suite 5: Immutability & Audit Log Integrity ---');
    assert(auditService.deleteAuditLog === undefined, 'IMMUTABILITY VERIFIED: No deleteAuditLog method exists on audit service');
    assert(auditService.updateAuditLog === undefined, 'IMMUTABILITY VERIFIED: No updateAuditLog method exists on audit service');

    console.log('\n======================================================');
    console.log(`🏁 AUDIT MODULE INTEGRATION TEST RESULTS:`);
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

runAuditIntegrationTests();
