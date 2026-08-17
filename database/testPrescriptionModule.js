const db = require('../server/config/db');
const prescriptionService = require('../server/services/prescription.service');

async function runPrescriptionIntegrationTests() {
  console.log('🧪 Starting Prescription Management Module Integration Tests...\n');
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
  const mockPharmacist = { id: 1, role: 'hospital_admin' };
  const mockPatientArthur = { id: 3, role: 'patient' };

  try {
    // Test Suite 1: Dynamic Medicines Formulary from MySQL
    console.log('--- Test Suite 1: Dynamic Medicines Formulary ---');
    const meds = await prescriptionService.listMedicines();
    assert(meds.length >= 10, 'Retrieves active medicines catalog from MySQL');
    assert(meds.some(m => m.name === 'Augmentin'), 'Formulary includes Augmentin');
    assert(meds.some(m => m.generic_name.includes('Amoxicillin')), 'Formulary includes Amoxicillin');

    const searchMeds = await prescriptionService.listMedicines({ search: 'Rosuvastatin' });
    assert(searchMeds.length >= 1, 'Search finds medicine by generic name');
    assert(searchMeds[0].name === 'Crestor', 'Matched brand name is Crestor');

    // Test Suite 2: Multi-Item Prescription Creation (Draft)
    console.log('\n--- Test Suite 2: Multi-Item Prescription Creation (Draft) ---');
    const createRes = await prescriptionService.createPrescription({
      patient_id: 1,
      doctor_id: 1,
      status: 'draft',
      diagnosis: 'Acute Bacterial Pharyngitis & Seasonal Allergic Rhinitis',
      doctor_notes: 'Advised warm saline gargles. Complete full 7-day antibiotic course.',
      patient_advice: 'Avoid cold beverages. Rest voice. Return if fever persists past 3 days.',
      items: [
        {
          medicine_id: 9,
          medicine_name: 'Augmentin',
          generic_name: 'Amoxicillin / Clavulanic Acid',
          dosage: '625mg',
          frequency: 'Twice daily (BD)',
          route: 'Oral',
          duration: '7 days',
          instructions: 'Take with food or start of meals',
          quantity: '14 Tablets',
          unit_price: 24.50
        },
        {
          medicine_name: 'Zyrtec (Cetirizine)',
          generic_name: 'Cetirizine Hydrochloride',
          dosage: '10mg',
          frequency: 'Once daily (bedtime)',
          route: 'Oral',
          duration: '14 days',
          instructions: 'Take at night. May cause mild drowsiness',
          quantity: '14 Tablets',
          unit_price: 8.50
        },
        {
          medicine_id: 7,
          medicine_name: 'Panadol Extra',
          generic_name: 'Paracetamol / Caffeine',
          dosage: '500mg/65mg',
          frequency: 'Every 6 hours as needed (PRN)',
          route: 'Oral',
          duration: '5 days',
          instructions: 'Take with plenty of water for fever > 100.4°F',
          quantity: '20 Tablets',
          unit_price: 6.50
        }
      ]
    }, mockDoctor);

    assert(createRes.id > 0, 'Prescription order created in MySQL');
    assert(createRes.prescription_number.startsWith('RX-'), 'Prescription number generated (RX-YYYY-XXXXXX)');
    assert(createRes.status === 'draft', 'Initial status is draft');
    assert(createRes.is_locked === 0, 'Draft prescription is unlocked');
    assert(createRes.items_count === 3, 'Contains 3 distinct medication line items');

    const draftId = createRes.id;

    // Test Suite 3: Edit Draft Prescription
    console.log('\n--- Test Suite 3: Edit Draft Prescription ---');
    const updateRes = await prescriptionService.updatePrescription(draftId, {
      patient_id: 1,
      doctor_id: 1,
      diagnosis: 'Acute Bacterial Pharyngitis & Mild Reactive Bronchospasm',
      doctor_notes: 'Added Salbutamol inhaler for occasional wheezing.',
      items: [
        {
          medicine_id: 9,
          medicine_name: 'Augmentin',
          generic_name: 'Amoxicillin / Clavulanic Acid',
          dosage: '625mg',
          frequency: 'Twice daily (BD)',
          route: 'Oral',
          duration: '7 days',
          instructions: 'Take with food',
          quantity: '14 Tablets'
        },
        {
          medicine_id: 4,
          medicine_name: 'Ventolin',
          generic_name: 'Salbutamol',
          dosage: '100mcg',
          frequency: '2 puffs every 6 hours PRN',
          route: 'Inhalation',
          duration: '14 days',
          instructions: 'Inhale for wheezing',
          quantity: '1 Inhaler'
        }
      ]
    }, mockDoctor);

    assert(updateRes.id === draftId, 'Draft prescription updated successfully');

    // Test Suite 4: Finalize & Lock Prescription
    console.log('\n--- Test Suite 4: Finalize & Lock Prescription ---');
    const finalizeRes = await prescriptionService.finalizePrescription(draftId, mockDoctor);
    assert(finalizeRes.status === 'finalized', 'Prescription status transitioned to finalized');
    assert(finalizeRes.is_locked === 1, 'Prescription is locked (is_locked = 1)');

    // Test Suite 5: CRITICAL SECURITY TEST - Prevent Unauthorized Modification of Finalized Rx
    console.log('\n--- Test Suite 5: Prevent Modification of Finalized Prescription ---');
    let lockedErrorCaught = false;
    try {
      await prescriptionService.updatePrescription(draftId, {
        patient_id: 1,
        items: [{ medicine_name: 'Unauthorized Drug', dosage: '100mg', frequency: 'OD', duration: '5d' }]
      }, mockDoctor);
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes('Finalized prescriptions')) {
        lockedErrorCaught = true;
      }
    }
    assert(lockedErrorCaught, 'BLOCKED: Editing finalized locked prescription throws 400 Bad Request');

    // Test Suite 6: View Full Prescription Order File
    console.log('\n--- Test Suite 6: View Full Prescription Order File ---');
    const fullRx = await prescriptionService.getPrescriptionById(draftId, mockDoctor);
    assert(fullRx.id === draftId, 'Prescription retrieved by ID');
    assert(fullRx.patient_name.includes('Arthur'), 'Includes patient name');
    assert(fullRx.patient_code === 'PAT-2026-0001', 'Includes patient code');
    assert(fullRx.doctor_name !== undefined, 'Includes attending doctor');
    assert(fullRx.items.length === 2, 'Line items retrieved with full dosage and route');
    assert(fullRx.items[1].route === 'Inhalation', 'Line item route is Inhalation');

    // Test Suite 7: Pharmacy Dispensation & Stock Update
    console.log('\n--- Test Suite 7: Pharmacy Dispensation & Stock Deduction ---');
    const [medBefore] = await db.query('SELECT stock_quantity FROM medicines WHERE id = 4');
    const stockBefore = medBefore[0].stock_quantity;

    const dispenseRes = await prescriptionService.dispensePrescription(draftId, mockPharmacist);
    assert(dispenseRes.status === 'dispensed', 'Prescription transitioned to dispensed');

    const [medAfter] = await db.query('SELECT stock_quantity FROM medicines WHERE id = 4');
    assert(medAfter[0].stock_quantity === stockBefore - 1, 'Pharmacy stock deducted (stock_quantity - 1)');

    // Test Suite 8: Prescription KPIs & Analytics
    console.log('\n--- Test Suite 8: Prescription KPIs & Analytics ---');
    const stats = await prescriptionService.getPrescriptionStats();
    assert(stats.total >= 4, 'Total prescription orders calculated');
    assert(stats.total_items_prescribed >= 5, 'Total prescription line items calculated');
    assert(stats.active_medicines >= 10, 'Active formulary medicines count calculated');

    // Clean up test order
    await db.query('DELETE FROM prescription_orders WHERE id = ?', [draftId]);

    console.log('\n======================================================');
    console.log(`🏁 PRESCRIPTION MODULE INTEGRATION TEST RESULTS:`);
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

runPrescriptionIntegrationTests();
