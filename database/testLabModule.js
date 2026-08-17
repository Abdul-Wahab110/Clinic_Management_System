const db = require('../server/config/db');
const labService = require('../server/services/lab.service');

async function runLabIntegrationTests() {
  console.log('🧪 Starting Laboratory Management Module Integration Tests...\n');
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

  const mockDoctor = { id: 2, role: 'doctor' };
  const mockPathologist = { id: 1, role: 'hospital_admin' };
  const mockPatientArthur = { id: 3, role: 'patient' };

  try {
    // Test Suite 1: Test Categories & Dynamic Catalog
    console.log('--- Test Suite 1: Lab Categories & Dynamic Catalog ---');
    const categories = await labService.listLabCategories();
    assert(categories.length >= 6, 'Retrieves active laboratory categories');
    assert(categories.some(c => c.code === 'HEM'), 'Includes Hematology category');
    assert(categories.some(c => c.code === 'BIO'), 'Includes Clinical Biochemistry category');

    const tests = await labService.listLabTests();
    assert(tests.length >= 6, 'Retrieves active laboratory tests catalog');
    assert(tests.some(t => t.code === 'CBC-01'), 'Includes CBC test');
    assert(tests.some(t => t.default_parameters && t.default_parameters.length > 0), 'Tests include multi-parameter templates');

    const searchRes = await labService.listLabTests({ search: 'Lipid' });
    assert(searchRes.length >= 1, 'Search finds test by keyword');
    assert(searchRes[0].name.includes('Lipid'), 'Matched test is Lipid Profile Panel');

    // Test Suite 2: Lab Order Creation Workflow (Doctor Requisition)
    console.log('\n--- Test Suite 2: Lab Order Creation Workflow ---');
    const createOrderRes = await labService.createLabOrder({
      patient_id: 1,
      doctor_id: 1,
      priority: 'urgent',
      clinical_notes: 'Evaluate renal function and thyroid profile pre-procedure.',
      test_ids: [3, 5] // BMP and Thyroid Panel
    }, mockDoctor);

    assert(createOrderRes.id > 0, 'Lab order created in MySQL');
    assert(createOrderRes.order_number.startsWith('LAB-'), 'Unique order number generated (LAB-YYYY-XXXXXX)');
    assert(createOrderRes.status === 'ordered', 'Initial status is ordered');
    assert(createOrderRes.items_count === 2, 'Contains 2 distinct laboratory tests');
    assert(createOrderRes.total_price > 0, 'Calculates combined test order pricing');

    const orderId = createOrderRes.id;

    // Test Suite 3: Sample Collection Phase
    console.log('\n--- Test Suite 3: Sample Collection Phase ---');
    const sampleRes = await labService.updateOrderStatus(orderId, 'sample_collected', { sample_type: 'Venous Blood (Serum SST)' }, mockPathologist);
    assert(sampleRes.status === 'sample_collected', 'Order transitioned to sample_collected');

    const orderAfterSample = await labService.getLabOrderById(orderId, mockDoctor);
    assert(orderAfterSample.sample_collected_at !== null, 'Sample collection timestamp recorded');

    // Test Suite 4: Processing Phase
    console.log('\n--- Test Suite 4: Processing Phase ---');
    const processRes = await labService.updateOrderStatus(orderId, 'processing', {}, mockPathologist);
    assert(processRes.status === 'processing', 'Order transitioned to processing');

    // Test Suite 5: Multi-Parameter Result Entry
    console.log('\n--- Test Suite 5: Multi-Parameter Result Entry ---');
    const saveResultsRes = await labService.saveLabResults(orderId, {
      status: 'completed',
      result_notes: 'All metabolic parameters within normal ranges except mildly elevated TSH.',
      results: [
        {
          parameter_name: 'Fasting Blood Glucose',
          result_value: '94',
          unit: 'mg/dL',
          reference_range: '70 - 99',
          flag: 'normal',
          comments: 'Normal fasting glucose'
        },
        {
          parameter_name: 'Serum Creatinine',
          result_value: '0.98',
          unit: 'mg/dL',
          reference_range: '0.7 - 1.3',
          flag: 'normal',
          comments: 'Adequate glomerular filtration'
        },
        {
          parameter_name: 'Serum Potassium (K+)',
          result_value: '4.2',
          unit: 'mEq/L',
          reference_range: '3.5 - 5.1',
          flag: 'normal',
          comments: 'Normal electrolyte balance'
        },
        {
          parameter_name: 'Thyroid Stimulating Hormone (TSH)',
          result_value: '5.40',
          unit: 'uIU/mL',
          reference_range: '0.45 - 4.50',
          flag: 'high',
          comments: 'Mild subclinical elevation'
        },
        {
          parameter_name: 'Free Thyroxine (FT4)',
          result_value: '1.20',
          unit: 'ng/dL',
          reference_range: '0.82 - 1.77',
          flag: 'normal',
          comments: 'Normal active thyroid hormone'
        }
      ]
    }, mockPathologist);

    assert(saveResultsRes.status === 'completed', 'Order status updated to completed upon result entry');
    assert(saveResultsRes.results_saved === 5, '5 distinct test parameters saved in lab_results');

    // Test Suite 6: Result Verification & Report Release
    console.log('\n--- Test Suite 6: Result Verification & Report Release ---');
    const verifyRes = await labService.verifyLabResults(orderId, mockDoctor);
    assert(verifyRes.status === 'verified', 'Order status verified by physician/pathologist');

    // Test Suite 7: Detailed Printable Laboratory Report File
    console.log('\n--- Test Suite 7: Detailed Laboratory Report File ---');
    const reportFile = await labService.getLabOrderById(orderId, mockDoctor);
    assert(reportFile.id === orderId, 'Report retrieved by ID');
    assert(reportFile.patient_name.includes('Arthur'), 'Report includes patient demographics');
    assert(reportFile.patient_code === 'PAT-2026-0001', 'Report includes patient code');
    assert(reportFile.results.length === 5, 'Report includes all 5 parameter results');
    assert(reportFile.results.some(r => r.flag === 'high'), 'Report highlights flagged abnormal parameter (TSH high)');
    assert(reportFile.verified_at !== null, 'Report contains verification timestamp');

    // Test Suite 8: Clinical Security Isolation
    console.log('\n--- Test Suite 8: Clinical Security Isolation ---');
    let forbiddenCaught = false;
    try {
      await labService.getLabOrderById(3, mockPatientArthur); // Order 3 is Patient 2's MRI
    } catch (err) {
      if (err.statusCode === 403) forbiddenCaught = true;
    }
    assert(forbiddenCaught, 'BLOCKED: Patient Arthur is FORBIDDEN (403) from accessing Patient 2 lab report');

    // Test Suite 9: Laboratory Statistics & KPIs
    console.log('\n--- Test Suite 9: Laboratory Statistics & KPIs ---');
    const stats = await labService.getLabStats();
    assert(stats.total_orders >= 5, 'Total lab orders calculated');
    assert(stats.active_tests_catalog >= 6, 'Active tests catalog count calculated');
    assert(stats.total_results_recorded >= 10, 'Total parameter results recorded count calculated');

    // Clean up test order
    await db.query('DELETE FROM lab_orders WHERE id = ?', [orderId]);

    console.log('\n======================================================');
    console.log(`🏁 LABORATORY MODULE INTEGRATION TEST RESULTS:`);
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

runLabIntegrationTests();
