const db = require('../server/config/db');
const ipdService = require('../server/services/ipd.service');

async function runIpdIntegrationTests() {
  console.log('🧪 Starting Inpatient Department (IPD) & Admission Module Integration Tests...\n');
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

  const mockAdmin = { id: 1, role: 'hospital_admin' };

  try {
    // Ensure deterministic bed and admission state for testing
    await db.query("UPDATE beds SET status = 'available' WHERE bed_number LIKE 'BED-ICU%'");
    await db.query("UPDATE beds SET status = 'occupied' WHERE bed_number = 'BED-CCU-201A'");
    await db.query("UPDATE ipd_admissions SET status = 'discharged' WHERE patient_id = 2 AND status = 'admitted'");

    // Test Suite 1: Ward & Room Management
    console.log('--- Test Suite 1: Ward & Room Management ---');
    const wards = await ipdService.listWards();
    assert(wards.length >= 6, 'Retrieves active inpatient wards directory');
    assert(wards.some(w => w.code === 'ICU'), 'Includes Intensive Care Unit (ICU)');
    assert(wards.some(w => w.code === 'CCU'), 'Includes Coronary Care Unit (CCU)');
    assert(wards.some(w => w.code === 'PED-WARD'), 'Includes Pediatric Care Unit');
    assert(wards.some(w => w.code === 'MAT-WARD'), 'Includes Maternity & Labor Ward');
    assert(wards[0].hasOwnProperty('occupancy_rate_percent'), 'Ward includes live calculated occupancy rate');

    const rooms = await ipdService.listRooms();
    assert(rooms.length >= 8, 'Retrieves inpatient rooms across wards');
    assert(rooms.some(r => r.room_number === 'ICU-101'), 'Includes ICU Room 101');
    assert(rooms.some(r => r.room_number === 'CCU-201'), 'Includes CCU Room 201');

    // Test Suite 2: Bed Management & Visual Matrix
    console.log('\n--- Test Suite 2: Bed Management & Visual Matrix ---');
    const beds = await ipdService.listBeds();
    assert(beds.length >= 14, 'Retrieves all hospital inpatient beds from MySQL');
    assert(beds.some(b => b.bed_number === 'BED-ICU-101A'), 'Includes Bed BED-ICU-101A');
    assert(beds.some(b => b.status === 'available'), 'Includes available beds');
    assert(beds.some(b => b.status === 'occupied'), 'Includes occupied active beds');

    const visualMatrix = await ipdService.getBedVisualMatrix();
    assert(visualMatrix.length >= 6, 'Generates full hierarchical Ward visual matrix');
    assert(visualMatrix.some(w => w.beds && w.beds.length > 0), 'Ward matrix contains child bed items');
    assert(visualMatrix[0].hasOwnProperty('available_count'), 'Ward matrix includes available count');

    // Test Suite 3: IPD Patient Admission Workflow
    console.log('\n--- Test Suite 3: IPD Patient Admission Workflow ---');
    const [availBeds] = await db.query("SELECT * FROM beds WHERE status = 'available' AND bed_number LIKE 'BED-ICU%' LIMIT 2");
    assert(availBeds.length >= 2, 'Found at least 2 available ICU test beds');
    const testBed1 = availBeds[0];
    const testBed2 = availBeds[1];

    const admissionRes = await ipdService.createAdmission({
      patient_id: 2, // Eleanor
      doctor_id: 1, // Dr. Alexander
      department_id: 1, // Cardiology
      ward_id: testBed1.ward_id,
      room_id: testBed1.room_id,
      bed_id: testBed1.id,
      admission_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      admission_type: 'emergency',
      admitting_diagnosis: 'Acute Coronary Syndrome (NSTEMI) requiring urgent ICU continuous telemetry',
      chief_complaint: 'Substernal chest pressure radiating to left arm with diaphoresis',
      emergency_contact_name: 'Arthur Pendleton',
      emergency_contact_phone: '555-0199',
      emergency_contact_relation: 'Spouse',
      insurance_provider: 'Aetna Comprehensive Healthcare',
      insurance_policy_number: 'AET-2026-8811',
      initial_progress_notes: 'Patient admitted via ER triage. Continuous 12-lead telemetry initiated.',
      initial_treatment_plan: 'Aspirin 325mg stat, Heparin infusion protocol, Serial Troponin q4h.'
    }, mockAdmin);

    assert(admissionRes.id > 0, 'Inpatient admission created dynamically in MySQL');
    assert(admissionRes.admission_number.startsWith('IPD-'), 'Unique IPD Admission Number generated (IPD-YYYY-XXXXXX)');
    assert(admissionRes.status === 'admitted', 'Admission status initialized to admitted');
    const createdAdmId = admissionRes.id;

    // Verify bed status updated to 'occupied'
    const [bedAfterAdm] = await db.query('SELECT * FROM beds WHERE id = ?', [testBed1.id]);
    assert(bedAfterAdm[0].status === 'occupied', 'Target Bed status transitioned to OCCUPIED');
    assert(bedAfterAdm[0].current_admission_id === createdAdmId, 'Target Bed current_admission_id linked to admission');

    // Test Suite 4: Strict Double-Bed Assignment Safeguard
    console.log('\n--- Test Suite 4: Strict Double-Bed Assignment Safeguard ---');
    let doubleBookingBlocked = false;
    try {
      await ipdService.createAdmission({
        patient_id: 3,
        doctor_id: 1,
        department_id: 1,
        ward_id: testBed1.ward_id,
        room_id: testBed1.room_id,
        bed_id: testBed1.id, // Trying to assign occupied testBed1
        admitting_diagnosis: 'Secondary admission attempt on occupied bed'
      }, mockAdmin);
    } catch (err) {
      if (err.statusCode === 409 && err.message.includes('currently OCCUPIED')) {
        doubleBookingBlocked = true;
      }
    }
    assert(doubleBookingBlocked, 'BLOCKED: Attempt to assign occupied bed is rejected with 409 Conflict');

    // Test Suite 5: Patient Bed / Room / Ward Transfer Workflow
    console.log('\n--- Test Suite 5: Patient Bed Transfer Workflow ---');
    const transferRes = await ipdService.transferPatient({
      admission_id: createdAdmId,
      to_bed_id: testBed2.id,
      transfer_reason: 'Step-down transfer to adjacent monitored ICU bed for bedside echocardiogram access'
    }, mockAdmin);

    assert(transferRes.transfer_number.startsWith('TRF-'), 'Unique Transfer Number generated (TRF-YYYY-XXXXXX)');

    // Verify old bed is marked for cleaning
    const [oldBedCheck] = await db.query('SELECT * FROM beds WHERE id = ?', [testBed1.id]);
    assert(oldBedCheck[0].status === 'cleaning', 'Previous Bed marked for CLEANING (sanitation)');
    assert(oldBedCheck[0].current_admission_id === null, 'Previous Bed admission pointer released');

    // Verify new bed is occupied
    const [newBedCheck] = await db.query('SELECT * FROM beds WHERE id = ?', [testBed2.id]);
    assert(newBedCheck[0].status === 'occupied', 'New Destination Bed marked as OCCUPIED');
    assert(newBedCheck[0].current_admission_id === createdAdmId, 'New Destination Bed linked to admission');

    // Test Suite 6: Daily Clinical Rounds & Doctor Notes
    console.log('\n--- Test Suite 6: Daily Clinical Rounds ---');
    const roundRes = await ipdService.addDailyRound(createdAdmId, {
      doctor_id: 1,
      progress_notes: 'Patient chest pain resolved. Troponin peaked and trending downward. Telemetry shows normal sinus rhythm.',
      treatment_plan: 'Transition from IV Heparin to oral anticoagulant. Ambulation with nursing supervision.',
      nursing_instructions: 'Check telemetry leads twice per shift. Monitor morning electrolytes.'
    }, mockAdmin);

    assert(roundRes.id > 0, 'Daily clinical round note recorded');
    const roundsList = await ipdService.listDailyRounds(createdAdmId);
    assert(roundsList.length >= 2, 'Admission contains initial note + daily clinical round note');

    // Test Suite 7: Patient Discharge Workflow & Automatic Bed Release
    console.log('\n--- Test Suite 7: Patient Discharge Workflow ---');
    const dischargeRes = await ipdService.dischargePatient(createdAdmId, {
      discharge_type: 'routine_recovered',
      discharge_summary: '48-hour acute coronary telemetry protocol completed without recurrent ischemic events. Coronary angiography planned outpatient.',
      final_diagnosis: 'Unstable Angina / Resolved NSTEMI (Killip Class I)',
      discharge_advice: 'Low sodium cardiac diet, avoid heavy lifting for 2 weeks. Return to ER if chest pain recurs.',
      follow_up_date: '2026-08-30'
    }, mockAdmin);

    assert(dischargeRes.status === 'discharged', 'Admission status transitioned to DISCHARGED');

    // Verify discharged bed is released for cleaning
    const [dischargedBedCheck] = await db.query('SELECT * FROM beds WHERE id = ?', [testBed2.id]);
    assert(dischargedBedCheck[0].status === 'cleaning', 'Discharged Bed automatically released and set to CLEANING');
    assert(dischargedBedCheck[0].current_admission_id === null, 'Discharged Bed admission pointer cleared');

    // Test Suite 8: Bed Sanitization Status Update
    console.log('\n--- Test Suite 8: Bed Status & Sanitization ---');
    const bedStatusRes = await ipdService.updateBedStatus(testBed1.id, { status: 'available' });
    assert(bedStatusRes.status === 'available', 'Bed marked as AVAILABLE after sanitation');
    await ipdService.updateBedStatus(testBed2.id, { status: 'available' });

    // Test Suite 9: IPD Statistics & Occupancy KPIs
    console.log('\n--- Test Suite 9: IPD Statistics & Occupancy KPIs ---');
    const stats = await ipdService.getIpdStats();
    assert(stats.total_wards >= 6, 'Total wards calculated');
    assert(stats.total_beds >= 14, 'Total beds calculated');
    assert(stats.hasOwnProperty('occupancy_rate_percent'), 'Hospital occupancy rate percent calculated');
    assert(stats.total_admissions >= 1, 'Total admissions calculated');

    // Clean up test data
    await db.query('DELETE FROM ipd_daily_rounds WHERE admission_id = ?', [createdAdmId]);
    await db.query('DELETE FROM ipd_patient_transfers WHERE admission_id = ?', [createdAdmId]);
    await db.query('DELETE FROM ipd_admissions WHERE id = ?', [createdAdmId]);

    console.log('\n======================================================');
    console.log(`🏁 IPD MODULE INTEGRATION TEST RESULTS:`);
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

runIpdIntegrationTests();
