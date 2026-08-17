const db = require('../server/config/db');
const radiologyService = require('../server/services/radiology.service');

async function runRadiologyIntegrationTests() {
  console.log('🧪 Starting Radiology & Imaging Module Integration Tests...\n');
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
  const mockRadiologist = { id: 1, role: 'hospital_admin' };
  const mockPatientArthur = { id: 3, role: 'patient' };

  try {
    // Test Suite 1: Modalities & Dynamic Services Catalog
    console.log('--- Test Suite 1: Modalities & Dynamic Services Catalog ---');
    const modalities = await radiologyService.listModalities();
    assert(modalities.length >= 6, 'Retrieves active radiology modalities');
    assert(modalities.some(m => m.code === 'XR'), 'Includes Digital X-Ray modality');
    assert(modalities.some(m => m.code === 'MRI'), 'Includes 3.0T MRI modality');
    assert(modalities.some(m => m.code === 'CT'), 'Includes CT Scan modality');
    assert(modalities.some(m => m.code === 'USG'), 'Includes Ultrasound modality');
    assert(modalities.some(m => m.code === 'ECG'), 'Includes ECG modality');

    const services = await radiologyService.listServices();
    assert(services.length >= 10, 'Retrieves active radiology services catalog from MySQL');
    assert(services.some(s => s.code === 'XR-CHEST-01'), 'Includes Chest X-Ray service');
    assert(services.some(s => s.code === 'MRI-BRAIN-01'), 'Includes Brain MRI service');

    const searchRes = await radiologyService.listServices({ search: 'Spine' });
    assert(searchRes.length >= 1, 'Search finds services by keyword');
    assert(searchRes.some(s => s.name.includes('Spine')), 'Matched service is Spine imaging');

    // Test Suite 2: Dynamic Service Creation by Administrator
    console.log('\n--- Test Suite 2: Dynamic Service Creation by Administrator ---');
    const newServiceRes = await radiologyService.createService({
      modality_id: 3, // CT
      name: 'Coronary CT Angiography (CCTA)',
      code: 'CT-CORONARY-99',
      body_part: 'Heart / Coronary Arteries',
      contrast_required: true,
      fasting_required: true,
      duration_minutes: 35,
      preparation_instructions: 'NPO 4 hours prior. Beta-blocker administered if heart rate > 65 bpm.',
      price: 480.00
    });

    assert(newServiceRes.id > 0, 'New radiology service created dynamically in MySQL');
    assert(newServiceRes.code === 'CT-CORONARY-99', 'Service code matches input');

    // Test Suite 3: Imaging Order Creation Workflow
    console.log('\n--- Test Suite 3: Imaging Order Creation Workflow ---');
    const createOrderRes = await radiologyService.createOrder({
      patient_id: 1,
      doctor_id: 1,
      service_id: 10, // Brain MRI 3.0T
      priority: 'urgent',
      clinical_indication: 'Evaluation of persistent tension headache and visual scotoma. Rule out structural lesion.'
    }, mockDoctor);

    assert(createOrderRes.id > 0, 'Radiology order created in MySQL');
    assert(createOrderRes.order_number.startsWith('RAD-'), 'Unique order number generated (RAD-YYYY-XXXXXX)');
    assert(createOrderRes.status === 'ordered', 'Initial status is ordered');
    assert(createOrderRes.price > 0, 'Service pricing attached dynamically');

    const orderId = createOrderRes.id;

    // Test Suite 4: Procedure Scheduling & Machine Assignment
    console.log('\n--- Test Suite 4: Procedure Scheduling & Machine Assignment ---');
    const scheduleRes = await radiologyService.scheduleOrder(orderId, {
      scheduled_date: '2026-08-20',
      scheduled_time: '15:00:00',
      room_number: 'MRI Unit East Wing',
      technician_name: 'David Keller, RT(MR)'
    }, mockRadiologist);

    assert(scheduleRes.status === 'scheduled', 'Order transitioned to scheduled');

    const scheduledOrder = await radiologyService.getOrderById(orderId, mockDoctor);
    assert(scheduledOrder.scheduled_date === '2026-08-20', 'Scheduled date matches input');
    assert(scheduledOrder.room_number === 'MRI Unit East Wing', 'Equipment room assigned');

    // Test Suite 5: Procedure Execution Workflow (In Progress & Completed)
    console.log('\n--- Test Suite 5: Procedure Execution Workflow ---');
    const inProgressRes = await radiologyService.updateOrderStatus(orderId, 'in_progress', {}, mockRadiologist);
    assert(inProgressRes.status === 'in_progress', 'Order transitioned to in_progress');

    // Test Suite 6: Diagnostic Findings & PACS Report Entry
    console.log('\n--- Test Suite 6: Diagnostic Findings & PACS Report Entry ---');
    const saveReportRes = await radiologyService.saveReport(orderId, {
      status: 'completed',
      findings: 'BRAIN PARENCHYMA: Multiplanar T1, T2, FLAIR and DWI sequences demonstrate normal gray-white matter differentiation. No intracranial mass, acute territorial infarction, or hemorrhage.\nVENTRICLES: Symmetrical and non-dilated. Basal cisterns are clear.\nPARANASAL SINUSES: Mild mucosal thickening in right maxillary sinus.',
      impression: '1. Normal 3.0 Tesla Brain MRI with no intracranial mass effect, acute infarction, or demyelination.\n2. Mild right maxillary sinusitis.',
      recommendations: 'Symptomatic management for tension headache. Clinical ENT follow-up if sinus symptoms develop.',
      radiation_dose: '0.0 mSv (Non-ionizing RF)',
      contrast_details: 'Non-contrast study performed.',
      pacs_image_url: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&auto=format&fit=crop&q=80',
      is_critical_finding: false
    }, mockRadiologist);

    assert(saveReportRes.status === 'completed', 'Report saved and order marked as completed');

    // Test Suite 7: Report Verification & Release
    console.log('\n--- Test Suite 7: Report Verification & Release ---');
    const verifyRes = await radiologyService.verifyReport(orderId, mockDoctor);
    assert(verifyRes.status === 'verified', 'Report verified and authorized for patient release');

    // Test Suite 8: Detailed Printable Radiology Report File
    console.log('\n--- Test Suite 8: Detailed Radiology Report File ---');
    const reportFile = await radiologyService.getOrderById(orderId, mockDoctor);
    assert(reportFile.id === orderId, 'Report retrieved by ID');
    assert(reportFile.patient_name.includes('Arthur'), 'Report includes patient demographics');
    assert(reportFile.patient_code === 'PAT-2026-0001', 'Report includes patient code');
    assert(reportFile.findings.includes('BRAIN PARENCHYMA'), 'Report includes detailed findings');
    assert(reportFile.impression.includes('Normal 3.0 Tesla Brain MRI'), 'Report includes diagnostic impression');
    assert(reportFile.verified_at !== null, 'Report contains official verification timestamp');

    // Test Suite 9: Clinical Security Isolation
    console.log('\n--- Test Suite 9: Clinical Security Isolation ---');
    let forbiddenCaught = false;
    try {
      await radiologyService.getOrderById(2, mockPatientArthur); // Order 2 is Patient 2's Brain MRI
    } catch (err) {
      if (err.statusCode === 403) forbiddenCaught = true;
    }
    assert(forbiddenCaught, 'BLOCKED: Patient Arthur is FORBIDDEN (403) from accessing Patient 2 radiology report');

    // Test Suite 10: Radiology Statistics & KPIs
    console.log('\n--- Test Suite 10: Radiology Statistics & KPIs ---');
    const stats = await radiologyService.getRadiologyStats();
    assert(stats.total_orders >= 3, 'Total radiology orders calculated');
    assert(stats.active_services_catalog >= 10, 'Active services catalog count calculated');
    assert(stats.active_modalities >= 6, 'Active modalities count calculated');

    // Clean up test order and created service
    await db.query('DELETE FROM radiology_orders WHERE id = ?', [orderId]);
    await db.query('DELETE FROM radiology_services WHERE id = ?', [newServiceRes.id]);

    console.log('\n======================================================');
    console.log(`🏁 RADIOLOGY MODULE INTEGRATION TEST RESULTS:`);
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

runRadiologyIntegrationTests();
