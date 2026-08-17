const reportService = require('../server/services/report.service');

async function runReportIntegrationTests() {
  console.log('🧪 Starting Reports and Analytics Module Integration Tests...\n');
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
    // Test Suite 1: Executive Master Analytics Overview
    console.log('--- Test Suite 1: Executive Master Analytics Overview ---');
    const overview = await reportService.getExecutiveOverview({ timeframe: 'all_time' });
    assert(overview.hasOwnProperty('financials'), 'Overview includes financials object');
    assert(overview.financials.hasOwnProperty('total_invoiced'), 'Calculates total invoiced revenue');
    assert(overview.financials.hasOwnProperty('total_collected'), 'Calculates total collected revenue');
    assert(overview.financials.hasOwnProperty('total_outstanding'), 'Calculates total outstanding receivables');
    assert(overview.financials.hasOwnProperty('collection_rate_percent'), 'Calculates financial settlement rate %');
    assert(overview.hasOwnProperty('clinical_volumes'), 'Overview includes clinical volumes object');
    assert(overview.clinical_volumes.hasOwnProperty('new_patients'), 'Calculates new patient registrations');
    assert(overview.clinical_volumes.hasOwnProperty('appointments'), 'Calculates appointments volume');
    assert(overview.clinical_volumes.hasOwnProperty('opd_consultations'), 'Calculates OPD consultations volume');
    assert(overview.clinical_volumes.hasOwnProperty('ipd_admissions'), 'Calculates IPD admissions volume');
    assert(overview.clinical_volumes.hasOwnProperty('lab_orders'), 'Calculates diagnostic lab orders volume');

    // Test Suite 2: Dynamic Timeframe Filtering
    console.log('\n--- Test Suite 2: Dynamic Timeframe Filtering ---');
    const todayStats = await reportService.getExecutiveOverview({ timeframe: 'today' });
    assert(todayStats.financials !== undefined, 'Filter: TODAY executes cleanly');

    const yesterdayStats = await reportService.getExecutiveOverview({ timeframe: 'yesterday' });
    assert(yesterdayStats.financials !== undefined, 'Filter: YESTERDAY executes cleanly');

    const weekStats = await reportService.getExecutiveOverview({ timeframe: 'this_week' });
    assert(weekStats.financials !== undefined, 'Filter: THIS_WEEK executes cleanly');

    const monthStats = await reportService.getExecutiveOverview({ timeframe: 'this_month' });
    assert(monthStats.financials !== undefined, 'Filter: THIS_MONTH executes cleanly');

    const yearStats = await reportService.getExecutiveOverview({ timeframe: 'this_year' });
    assert(yearStats.financials !== undefined, 'Filter: THIS_YEAR executes cleanly');

    const customStats = await reportService.getExecutiveOverview({ date_from: '2026-01-01', date_to: '2026-12-31' });
    assert(customStats.financials !== undefined, 'Filter: CUSTOM DATE RANGE executes cleanly');

    // Test Suite 3: Patient Demographics & Registration Report
    console.log('\n--- Test Suite 3: Patient Demographics & Registration Report ---');
    const patReport = await reportService.getPatientRegistrationReport({ timeframe: 'all_time' });
    assert(Array.isArray(patReport.trend), 'Patient registration trend generated');
    assert(Array.isArray(patReport.gender_distribution), 'Gender distribution generated');
    assert(patReport.gender_distribution.length >= 2, 'Includes male and female patient breakdown');
    assert(Array.isArray(patReport.blood_groups), 'Blood groups breakdown generated');

    // Test Suite 4: Appointments & OPD Outpatient Report
    console.log('\n--- Test Suite 4: Appointments & OPD Outpatient Report ---');
    const appReport = await reportService.getAppointmentsAndOpdReport({ timeframe: 'all_time' });
    assert(Array.isArray(appReport.appointment_statuses), 'Appointment status breakdown generated');
    assert(Array.isArray(appReport.appointment_trend), 'Appointment time trend generated');
    assert(Array.isArray(appReport.opd_by_department), 'OPD consultations by department generated');

    // Test Suite 5: Inpatient (IPD) & Bed Occupancy Report
    console.log('\n--- Test Suite 5: Inpatient (IPD) & Bed Occupancy Report ---');
    const ipdReport = await reportService.getIpdReport({ timeframe: 'all_time' });
    assert(Array.isArray(ipdReport.trend), 'IPD admissions trend generated');
    assert(Array.isArray(ipdReport.wards_occupancy), 'Ward occupancy percentages generated');
    assert(ipdReport.hasOwnProperty('alos_days'), 'Average Length of Stay (ALOS) calculated');

    // Test Suite 6: Financial Revenue & Collections Report
    console.log('\n--- Test Suite 6: Financial Revenue & Collections Report ---');
    const finReport = await reportService.getFinancialRevenueReport({ timeframe: 'all_time' });
    assert(Array.isArray(finReport.revenue_by_modality), 'Revenue by clinical modality generated');
    assert(Array.isArray(finReport.collections_by_method), 'Collections by payment method generated');
    assert(Array.isArray(finReport.trend), 'Daily revenue and collections trend generated');
    assert(Array.isArray(finReport.receivables_aging), 'Accounts receivable aging breakdown generated');

    // Test Suite 7: Laboratory & Diagnostic Report
    console.log('\n--- Test Suite 7: Laboratory & Diagnostic Report ---');
    const labReport = await reportService.getLaboratoryReport({ timeframe: 'all_time' });
    assert(Array.isArray(labReport.status_breakdown), 'Lab test status breakdown generated');
    assert(Array.isArray(labReport.top_tests), 'Top ordered diagnostic tests generated');

    // Test Suite 8: Pharmacy & Medication Inventory Report
    console.log('\n--- Test Suite 8: Pharmacy & Medication Inventory Report ---');
    const rxReport = await reportService.getPharmacyReport({ timeframe: 'all_time' });
    assert(rxReport.hasOwnProperty('prescription_metrics'), 'Prescription dispensing metrics generated');
    assert(Array.isArray(rxReport.top_dispensed_medicines), 'Top dispensed medications list generated');
    assert(rxReport.hasOwnProperty('stock_alerts'), 'Low stock and expiry alerts generated');

    // Test Suite 9: Doctor Clinical Workload & Revenue Report
    console.log('\n--- Test Suite 9: Doctor Clinical Workload & Revenue Report ---');
    const docReport = await reportService.getDoctorProductivityReport({ timeframe: 'all_time' });
    assert(Array.isArray(docReport) && docReport.length >= 5, 'Doctor clinical workload and revenue report generated');
    assert(docReport[0].hasOwnProperty('doctor_name'), 'Includes doctor name');
    assert(docReport[0].hasOwnProperty('total_consultations'), 'Includes total consultations');
    assert(docReport[0].hasOwnProperty('total_generated_revenue'), 'Includes total generated revenue');

    // Test Suite 10: Department Performance Report
    console.log('\n--- Test Suite 10: Department Performance Report ---');
    const deptReport = await reportService.getDepartmentPerformanceReport({ timeframe: 'all_time' });
    assert(Array.isArray(deptReport) && deptReport.length >= 10, 'Department throughput and revenue report generated');
    assert(deptReport[0].hasOwnProperty('department_name'), 'Includes department name');
    assert(deptReport[0].hasOwnProperty('total_opd_visits'), 'Includes total OPD visits');
    assert(deptReport[0].hasOwnProperty('total_revenue'), 'Includes departmental revenue');

    console.log('\n======================================================');
    console.log(`🏁 REPORTS MODULE INTEGRATION TEST RESULTS:`);
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

runReportIntegrationTests();
