const db = require('../server/config/db');
const consultationService = require('../server/services/consultation.service');

async function runConsultationIntegrationTests() {
  console.log('🧪 Starting Doctor Consultation & EMR Module Integration Tests...\n');
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
  const mockAdmin = { id: 1, role: 'hospital_admin' };
  const mockPatientArthur = { id: 3, role: 'patient' }; // Linked to Patient 1

  try {
    // Test Suite 1: Patient Clinical Summary & Longitudinal EMR
    console.log('--- Test Suite 1: Comprehensive Patient Clinical EMR Summary ---');
    const summary = await consultationService.getPatientClinicalSummary(1, mockDoctor);
    assert(summary.patient.full_name.includes('Arthur'), 'Summary includes patient full name');
    assert(summary.patient.patient_code === 'PAT-2026-0001', 'Summary includes patient code');
    assert(typeof summary.patient.age === 'number', 'Summary computes patient age');
    assert(summary.has_allergies === true || summary.allergies.length > 0, 'Allergies alert detected');
    assert(summary.previous_visits.length >= 2, 'Chronological previous visits retrieved (at least 2 seeded)');
    assert(summary.previous_visits[0].record_date >= summary.previous_visits[1].record_date, 'Previous visits are sorted chronologically DESC');
    assert(summary.previous_visits[0].vitals !== null, 'Encounter includes attached vitals');
    assert(summary.previous_diagnoses.length >= 1, 'Previous diagnoses list is aggregated');
    assert(summary.previous_prescriptions.length >= 2, 'Previous prescriptions archive retrieved');
    assert(summary.previous_lab_reports.length >= 2, 'Previous diagnostic lab reports retrieved');

    // Test Suite 2: Non-Overwriting Consultation Encounter Documentation
    console.log('\n--- Test Suite 2: Traceable, Non-Overwriting Consultation Encounter ---');
    const initialVisitCount = summary.previous_visits.length;

    const newEncounterRes = await consultationService.saveConsultationRecord({
      patient_id: 1,
      doctor_id: 1,
      encounter_type: 'appointment',
      chief_complaint: 'Routine bi-monthly cardiac follow-up and prescription refill',
      symptoms: 'Reports no palpitations or chest pain. Energy levels normal. Mild seasonal allergies.',
      physical_examination: 'General: Well-nourished male in no acute distress. CV: S1/S2 normal, RRR, no murmurs. Lungs: Clear bilaterally.',
      diagnosis: 'Stable Essential Hypertension (ICD-10 I10) & Post-CABG Status (Z95.1)',
      treatment_plan: '1. Continue Amlodipine 10mg & Atorvastatin 40mg.\n2. Add Cetirizine 10mg PRN for seasonal rhinitis.\n3. Return in 3 months.',
      clinical_notes: 'Patient maintains good lifestyle compliance and low sodium diet.',
      doctor_notes: 'Patient motivated. Blood pressure remains target at 122/78.',
      follow_up_date: '2026-11-15',
      vitals: {
        systolic: 122,
        diastolic: 78,
        heart_rate: 70,
        temperature: 98.4,
        respiratory_rate: 14,
        oxygen_saturation: 99,
        weight_kg: 75.5,
        height_cm: 178
      },
      prescriptions: [
        {
          medicine_name: 'Amlodipine Besylate',
          dosage: '10 mg',
          frequency: 'Once daily (morning)',
          duration: '90 days',
          instructions: 'Take after breakfast'
        },
        {
          medicine_name: 'Cetirizine HCl',
          dosage: '10 mg',
          frequency: 'Once daily (at night)',
          duration: '14 days',
          instructions: 'Take at night if rhinitis flares'
        }
      ],
      lab_tests: [1] // CBC test
    }, mockDoctor);

    assert(newEncounterRes.id > 0, 'New consultation encounter created in MySQL');
    assert(newEncounterRes.prescriptions_count === 2, 'Prescriptions saved and linked to encounter');
    assert(newEncounterRes.lab_orders_count === 1, 'Diagnostic lab orders dispatched');

    // Verify chronological history grew without overwriting past records
    const updatedSummary = await consultationService.getPatientClinicalSummary(1, mockDoctor);
    assert(updatedSummary.previous_visits.length === initialVisitCount + 1, 'Past history preserved; new record appended chronologically');
    assert(updatedSummary.previous_visits[0].id === newEncounterRes.id, 'Newest consultation appears at top of chronological history');
    assert(updatedSummary.previous_visits[0].diagnosis.includes('Stable Essential Hypertension'), 'New encounter diagnosis recorded');
    assert(updatedSummary.previous_visits[0].vitals.bmi === 23.8, 'Vitals BMI calculated automatically (75.5 / 1.78^2 = 23.8)');
    assert(updatedSummary.previous_visits[0].prescriptions.length === 2, 'Attached prescriptions retrieved with encounter');

    // Test Suite 3: Medical Record Retrieval by ID
    console.log('\n--- Test Suite 3: Medical Record Chart Retrieval ---');
    const singleRecord = await consultationService.getMedicalRecordById(newEncounterRes.id, mockDoctor);
    assert(singleRecord.id === newEncounterRes.id, 'Record fetched by ID');
    assert(singleRecord.patient_name.includes('Arthur'), 'Joined patient name present');
    assert(singleRecord.doctor_name !== undefined, 'Joined doctor name present');
    assert(singleRecord.prescriptions.length === 2, 'Record includes prescriptions');

    // Test Suite 4: Security & Patient Authorization Isolation
    console.log('\n--- Test Suite 4: Clinical Security & Authorization Isolation ---');
    // Fetch patient 2 ID
    const [pat2] = await db.query('SELECT id FROM patients WHERE id != 1 LIMIT 1');
    if (pat2.length > 0) {
      let forbiddenErrorCaught = false;
      try {
        await consultationService.getPatientClinicalSummary(pat2[0].id, mockPatientArthur);
      } catch (err) {
        if (err.statusCode === 403) forbiddenErrorCaught = true;
      }
      assert(forbiddenErrorCaught, 'Patient Arthur is FORBIDDEN (403) from viewing Patient 2 clinical EMR');
    }

    // Clean up created test encounter and prescriptions
    await db.query('DELETE FROM prescriptions WHERE record_id = ?', [newEncounterRes.id]);
    await db.query('DELETE FROM medical_records WHERE id = ?', [newEncounterRes.id]);

    console.log('\n======================================================');
    console.log(`🏁 CONSULTATION & EMR MODULE INTEGRATION TEST RESULTS:`);
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

runConsultationIntegrationTests();
