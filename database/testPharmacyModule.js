const db = require('../server/config/db');
const pharmacyService = require('../server/services/pharmacy.service');

async function runPharmacyIntegrationTests() {
  console.log('🧪 Starting Pharmacy Management Module Integration Tests...\n');
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
  const mockDoctor = { id: 2, role: 'doctor' };

  try {
    // Test Suite 1: Categories & Dynamic Medicine Catalog
    console.log('--- Test Suite 1: Categories & Dynamic Medicine Catalog ---');
    const categories = await pharmacyService.listCategories();
    assert(categories.length >= 8, 'Retrieves active pharmacy therapeutic categories');
    assert(categories.some(c => c.code === 'ABX'), 'Includes Antibiotics category');
    assert(categories.some(c => c.code === 'CVD'), 'Includes Cardiovascular category');
    assert(categories.some(c => c.code === 'PAIN'), 'Includes Analgesics category');

    const medRes = await pharmacyService.listMedicines({ limit: 50 });
    assert(medRes.medicines.length >= 15, 'Retrieves active medicines catalog from MySQL');
    assert(medRes.medicines.some(m => m.name.includes('Amoxil') || m.generic_name.includes('Amoxicillin')), 'Includes Amoxicillin / Amoxil');
    assert(medRes.medicines.every(m => m.batch_number && m.purchase_price !== undefined), 'All medicines contain batch numbers and purchase prices');

    const searchRes = await pharmacyService.listMedicines({ search: 'Atorvastatin' });
    assert(searchRes.medicines.length >= 1, 'Search finds medicines by generic/brand name');
    assert(searchRes.medicines[0].generic_name.includes('Atorvastatin'), 'Matched generic name is Atorvastatin');

    // Test Suite 2: Dynamic Medicine Creation in Catalog
    console.log('\n--- Test Suite 2: Dynamic Medicine Creation in Catalog ---');
    const newMedRes = await pharmacyService.createMedicine({
      name: 'Azithromycin 500mg (ZithroCare)',
      generic_name: 'Azithromycin Dihydrate',
      category: 'Antibiotics & Antimicrobials',
      form: 'tablet',
      strength: '500mg',
      batch_number: 'BAT-2026-AZ-99',
      unit_price: 3.50,
      purchase_price: 2.10,
      selling_price: 3.50,
      stock_quantity: 100,
      min_stock_level: 25,
      manufacturer: 'Pfizer BioPharma',
      location_shelf: 'Shelf B-2',
      expiry_date: '2028-06-30',
      requires_prescription: true
    });

    assert(newMedRes.id > 0, 'New medicine created dynamically in MySQL');
    assert(newMedRes.stock_quantity === 100, 'Initial stock saved correctly');
    assert(newMedRes.status === 'in_stock', 'Initial computed status is in_stock');
    const createdMedId = newMedRes.id;

    // Test Suite 3: Stock Adjustments & Transactional Audit Ledger
    console.log('\n--- Test Suite 3: Stock Adjustments & Audit Ledger ---');
    const stockAddRes = await pharmacyService.adjustStock({
      medicine_id: createdMedId,
      adjustment_type: 'purchase_received',
      quantity_change: 50,
      reason: 'Quarterly wholesale restock delivery from Pfizer distributor',
      batch_number: 'BAT-2026-AZ-99'
    }, mockAdmin);

    assert(stockAddRes.stock_after === 150, 'Stock successfully incremented from 100 to 150 (+50)');

    const adjAudit = await pharmacyService.listAdjustments({ medicine_id: createdMedId });
    assert(adjAudit.length >= 1, 'Stock adjustment audit ledger logged');
    assert(adjAudit[0].adjustment_type === 'purchase_received', 'Audit type matches purchase_received');

    // Test Suite 4: Strict Negative Stock Rule Safeguard
    console.log('\n--- Test Suite 4: Strict Negative Stock Rule Safeguard ---');
    let negativeStockBlocked = false;
    try {
      await pharmacyService.adjustStock({
        medicine_id: createdMedId,
        adjustment_type: 'correction',
        quantity_change: -9999, // Attempt to reduce beyond available stock
        reason: 'Faulty reduction test'
      }, mockAdmin);
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes('Insufficient stock')) {
        negativeStockBlocked = true;
      }
    }
    assert(negativeStockBlocked, 'BLOCKED: Stock reduction exceeding current inventory is rejected with 400 Bad Request');

    const medCheck = await pharmacyService.getMedicineById(createdMedId);
    assert(medCheck.stock_quantity === 150, 'Stock remained atomic and untouched at 150 after rollback');

    // Test Suite 5: Pharmacy Inventory Alerts (Low Stock, Out of Stock, Expiring)
    console.log('\n--- Test Suite 5: Pharmacy Inventory Alerts ---');
    const alerts = await pharmacyService.getStockAlerts();
    assert(alerts.summary.total_alerts > 0, 'Retrieves active inventory alerts');
    assert(alerts.low_stock.length >= 1, 'Identifies low stock medicines requiring reorder');
    assert(alerts.expiring_soon.length >= 1, 'Identifies medicines expiring within 60 days');

    // Test Suite 6: Prescription Dispensation Workflow
    console.log('\n--- Test Suite 6: Prescription Dispensation Workflow ---');
    const dispenseRes = await pharmacyService.dispensePrescription({
      prescription_id: 1,
      patient_id: 1,
      customer_name: 'Arthur Pendleton',
      items: [
        { medicine_id: createdMedId, quantity: 10, unit_price: 3.50 }
      ],
      payment_method: 'cash',
      discount: 0.00
    }, mockDoctor);

    assert(dispenseRes.sale_id > 0, 'Pharmacy sale invoice generated upon dispensation');
    assert(dispenseRes.invoice_number.startsWith('PHARM-'), 'Unique invoice number generated (PHARM-YYYY-XXXXXX)');
    assert(dispenseRes.total_amount > 0, 'Total bill calculated with tax');

    const medAfterDispense = await pharmacyService.getMedicineById(createdMedId);
    assert(medAfterDispense.stock_quantity === 140, 'Stock deducted from 150 to 140 (-10) after dispensation');

    // Test Suite 7: Point-of-Sale (POS) Direct Customer Sale
    console.log('\n--- Test Suite 7: Point-of-Sale (POS) Direct Customer Sale ---');
    const posSaleRes = await pharmacyService.processPosSale({
      customer_name: 'Eleanor Vance (Walk-in)',
      customer_phone: '555-9988',
      items: [
        { medicine_id: createdMedId, quantity: 5, unit_price: 3.50 }
      ],
      payment_method: 'card',
      discount: 1.00
    }, mockAdmin);

    assert(posSaleRes.sale_id > 0, 'Direct POS sale created successfully');
    const medAfterPos = await pharmacyService.getMedicineById(createdMedId);
    assert(medAfterPos.stock_quantity === 135, 'Stock deducted from 140 to 135 (-5) after POS sale');

    const saleRecord = await pharmacyService.getSaleById(posSaleRes.sale_id);
    assert(saleRecord.items.length === 1, 'Sale line items recorded in MySQL');
    const saleItemId = saleRecord.items[0].id;

    // Test Suite 8: Pharmacy Return & Restock Workflow
    console.log('\n--- Test Suite 8: Pharmacy Return & Restock Workflow ---');
    const returnRes = await pharmacyService.processReturn({
      sale_id: posSaleRes.sale_id,
      sale_item_id: saleItemId,
      quantity_returned: 2,
      reason: 'Patient purchased excess unopened strip',
      restock_item: true
    }, mockAdmin);

    assert(returnRes.return_number.startsWith('RET-'), 'Return reference number generated (RET-YYYY-XXXXXX)');
    assert(returnRes.refund_amount === 7.00, 'Refund amount calculated correctly ($3.50 * 2 = $7.00)');
    assert(returnRes.restocked === true, 'Item flagged for restock');

    const medAfterReturn = await pharmacyService.getMedicineById(createdMedId);
    assert(medAfterReturn.stock_quantity === 137, 'Stock restored from 135 to 137 (+2) upon return');

    // Test Suite 9: Pharmacy KPIs & Financial Valuation
    console.log('\n--- Test Suite 9: Pharmacy KPIs & Financial Valuation ---');
    const stats = await pharmacyService.getPharmacyStats();
    assert(stats.total_medicines >= 15, 'Total medicine catalog items calculated');
    assert(stats.total_sales_count >= 2, 'Total pharmacy sales count calculated');
    assert(stats.total_revenue > 0, 'Total pharmacy revenue calculated');
    assert(stats.total_inventory_valuation > 0, 'Total inventory asset valuation calculated');

    // Clean up created test medicine & sales
    await db.query('DELETE FROM pharmacy_returns WHERE sale_id = ?', [posSaleRes.sale_id]);
    await db.query('DELETE FROM pharmacy_sale_items WHERE sale_id = ?', [posSaleRes.sale_id]);
    await db.query('DELETE FROM pharmacy_sales WHERE id = ?', [posSaleRes.sale_id]);
    await db.query('DELETE FROM pharmacy_stock_adjustments WHERE medicine_id = ?', [createdMedId]);
    await db.query('DELETE FROM medicines WHERE id = ?', [createdMedId]);

    console.log('\n======================================================');
    console.log(`🏁 PHARMACY MODULE INTEGRATION TEST RESULTS:`);
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

runPharmacyIntegrationTests();
