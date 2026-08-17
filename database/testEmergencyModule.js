const db = require('../server/config/db');
const emergencyService = require('../server/services/emergency.service');

async function runEmergencyIntegrationTests() {
  console.log('🧪 Starting Emergency Department Module Integration Tests...\n');
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
  const mockDoctor = { id: 1, role: 'doctor' };
  const mockNurse = { id: 6, role: 'nurse' };

  try {
    // Test Suite 1: Emergency Department Queue & Priority Ordering
    console.log('--- Test Suite 1: Emergency Department Queue & Priority Ordering ---');
    const queue = await emergencyService.listEmergencyVisits({});
    assert(queue.visits.length >= 1, 'Retrieves active Emergency Department encounters');
    assert(queue.visits[0].hasOwnProperty('priority'), 'Visit includes priority classification');
    assert(['critical', 'high', 'medium', 'low'].includes(queue.visits[0].priority), 'Priority matches clinical standard');
    assert(queue.visits[0].hasOwnProperty('chief_complaint'), 'Visit includes chief complaint');
    assert(queue.visits[0].hasOwnProperty('patient_first_name'), 'Visit is connected to main patient record');

    // Test Suite 2: Emergency Registration with ER Bed & Triage Vitals
    console.log('\n--- Test Suite 2: Emergency Registration with ER Bed & Triage Vitals ---');
    // Find available ER Bed
    const [erBeds] = await db.query("SELECT id FROM beds WHERE bed_number LIKE 'BED-ER%' AND status = 'available' LIMIT 1");
    const erBedId = erBeds.length > 0 ? erBeds[0].id : null;

    const intakeData = {
      patient_id: 1, // Arthur Pendleton
      attending_doctor_id: 1,
      triage_nurse_id: 6,
      bed_id: erBedId,
      arrival_mode: 'ambulance',
      is_trauma: 1,
      chief_complaint: 'Trauma with acute left femur fracture and lacerations post-motor vehicle accident',
      initial_triage_assessment: 'Alert, severe pain, immobilized on backboard, bleeding controlled with pressure dressing.',
      triage_acuity_score: '2',
      priority: 'high',
      glasgow_coma_scale: 14,
      pain_scale: 8,
      blood_pressure: '145/90',
      heart_rate: 104,
      temperature: 37.1,
      oxygen_saturation: 97.0
    };

    const regRes = await emergencyService.registerEmergencyVisit(intakeData, mockNurse);
    assert(regRes.id > 0, 'Emergency encounter registered successfully in MySQL');
    assert(regRes.emergency_number.startsWith('ER-'), 'Unique ER Number generated (ER-YYYY-XXXXXX)');
    assert(regRes.priority === 'high', 'Priority recorded as HIGH');

    // Verify bed is occupied
    if (erBedId) {
      const [bCheck] = await db.query('SELECT status FROM beds WHERE id = ?', [erBedId]);
      assert(bCheck[0].status === 'occupied', 'ER Bed marked as OCCUPIED');
    }

    // Test Suite 3: Walk-in / Unknown Trauma Patient Registration (Connects with Patients Table)
    console.log('\n--- Test Suite 3: Walk-in / Unknown Trauma Patient Registration ---');
    const walkinRes = await emergencyService.registerEmergencyVisit({
      first_name: 'John',
      last_name: 'Doe (Trauma 02)',
      gender: 'male',
      date_of_birth: '1988-04-12',
      blood_group: 'O+',
      phone: '+1 555-999-0001',
      arrival_mode: 'walk_in',
      is_trauma: 0,
      chief_complaint: 'Acute severe asthma exacerbation with audible wheezing and cyanosis',
      triage_acuity_score: '1',
      priority: 'critical',
      blood_pressure: '130/85',
      heart_rate: 122,
      oxygen_saturation: 88.0
    }, mockNurse);

    assert(walkinRes.id > 0, 'Walk-in emergency encounter registered');
    assert(walkinRes.patient_id > 0, 'Patient record automatically provisioned in main patients table');
    assert(walkinRes.priority === 'critical', 'Critical priority tagged (ESI Level 1)');

    // Verify patient exists in patients table
    const [pCheck] = await db.query('SELECT patient_code, first_name FROM patients WHERE id = ?', [walkinRes.patient_id]);
    assert(pCheck.length > 0 && pCheck[0].patient_code.startsWith('PAT-'), 'Main Patient MRN generated (PAT-YYYY-XXXXXXX)');

    // Test Suite 4: Triage Re-assessment & Acuity Elevation
    console.log('\n--- Test Suite 4: Triage Re-assessment ---');
    const triageRes = await emergencyService.updateTriage(regRes.id, {
      triage_acuity_score: '1',
      priority: 'critical',
      glasgow_coma_scale: 15,
      pain_scale: 9,
      initial_triage_assessment: 'Elevated to Critical: Signs of internal pelvic hemorrhage suspected.'
    }, mockNurse);
    assert(triageRes.priority === 'critical', 'Emergency priority elevated to CRITICAL');

    // Test Suite 5: Primary & Secondary Survey Clinical Trauma Notes
    console.log('\n--- Test Suite 5: Primary & Secondary Survey Clinical Trauma Notes ---');
    const noteRes = await emergencyService.recordEmergencyClinicalNote({
      emergency_visit_id: regRes.id,
      doctor_id: 1,
      nurse_id: 6,
      note_type: 'primary_survey',
      primary_survey_airway: 'Patent, non-obstructed, cervical collar in place',
      primary_survey_breathing: 'Equal bilateral breath sounds, non-labored',
      primary_survey_circulation: 'Pulse 102 bpm, BP 138/86, warm extremities',
      primary_survey_disability: 'GCS 15, pupils 3mm equal & reactive',
      primary_survey_exposure: 'Left femur deformity, multiple soft tissue abrasions',
      clinical_findings: 'Closed left mid-shaft femoral fracture. Neurovascular examination intact distally.',
      treatment_orders: 'STAT portable X-Ray femur/pelvis, Morphine 4mg IV, Cefazolin 2g IV, Traction splint.'
    }, mockDoctor);

    assert(noteRes.id > 0, 'Emergency clinical trauma note recorded in MySQL');
    assert(noteRes.note_number.startsWith('ERN-'), 'Unique Note Number generated (ERN-YYYY-XXXXXX)');

    // Test Suite 6: Emergency Treatments Administration
    console.log('\n--- Test Suite 6: Emergency Treatments Administration ---');
    const treatRes = await emergencyService.recordEmergencyTreatment({
      emergency_visit_id: regRes.id,
      treatment_type: 'medication',
      description: 'Morphine Sulfate IV Analgesia',
      dosage_spec: '4mg IV Push Slow',
      patient_response: 'Pain scale decreased from 9/10 to 4/10. Tolerated well.'
    }, mockNurse);

    assert(treatRes.id > 0, 'Emergency medication treatment recorded');
    assert(treatRes.treatment_number.startsWith('ERT-'), 'Unique Treatment Number generated (ERT-YYYY-XXXXXX)');

    // Test Suite 7: One-Click Emergency -> IPD Admission Workflow
    console.log('\n--- Test Suite 7: One-Click Emergency -> IPD Admission Workflow ---');
    // Find available IPD surgical/ICU bed
    const [ipdBeds] = await db.query("SELECT id, ward_id FROM beds WHERE status = 'available' AND bed_number NOT LIKE 'BED-ER%' LIMIT 1");
    const targetIpdBed = ipdBeds.length > 0 ? ipdBeds[0] : null;

    if (targetIpdBed) {
      const admitRes = await emergencyService.admitToIpd(regRes.id, {
        ward_id: targetIpdBed.ward_id,
        bed_id: targetIpdBed.id,
        admitting_diagnosis: 'Left mid-shaft femur fracture requiring urgent open reduction internal fixation (ORIF)'
      }, mockDoctor);

      assert(admitRes.admission_id > 0, 'Emergency patient successfully transitioned & admitted to IPD');
      assert(admitRes.admission_number.startsWith('IPD-'), 'IPD Admission Number generated (IPD-YYYY-XXXXXX)');

      // Verify ER encounter status
      const [erCheck] = await db.query('SELECT status, ipd_admission_id FROM emergency_visits WHERE id = ?', [regRes.id]);
      assert(erCheck[0].status === 'admitted_ipd', 'ER encounter status transitioned to ADMITTED_IPD');
      assert(erCheck[0].ipd_admission_id === admitRes.admission_id, 'ER encounter linked to IPD admission record');
    }

    // Test Suite 8: Emergency Transfer & Discharge Workflows
    console.log('\n--- Test Suite 8: Emergency Transfer & Discharge Workflows ---');
    const dischRes = await emergencyService.dischargePatient(walkinRes.id, {
      discharge_summary: 'Asthma exacerbation resolved with nebulized albuterol/ipratropium and IV dexamethasone. SpO2 99% on room air.'
    }, mockDoctor);
    assert(dischRes.status === 'discharged', 'Walk-in emergency patient stabilized and discharged home');

    // Test Suite 9: Emergency Department Statistics & KPIs
    console.log('\n--- Test Suite 9: Emergency Department Statistics & KPIs ---');
    const stats = await emergencyService.getEmergencyStats();
    assert(stats.hasOwnProperty('total_active_er'), 'Total active ER patients calculated');
    assert(stats.hasOwnProperty('total_er_beds'), 'Total ER beds calculated');
    assert(stats.hasOwnProperty('available_er_beds'), 'Available ER beds calculated');

    // Clean up test records
    await db.query('DELETE FROM emergency_treatments WHERE emergency_visit_id IN (?, ?)', [regRes.id, walkinRes.id]);
    await db.query('DELETE FROM emergency_clinical_notes WHERE emergency_visit_id IN (?, ?)', [regRes.id, walkinRes.id]);
    await db.query('DELETE FROM emergency_visits WHERE id IN (?, ?)', [regRes.id, walkinRes.id]);
    await db.query('DELETE FROM patients WHERE id = ?', [walkinRes.patient_id]);

    console.log('\n======================================================');
    console.log(`🏁 EMERGENCY MODULE INTEGRATION TEST RESULTS:`);
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

runEmergencyIntegrationTests();
