const db = require('../server/config/db');
const inventoryService = require('../server/services/inventory.service');

async function runInventoryIntegrationTests() {
  console.log('🧪 Starting Hospital Inventory Management Module Integration Tests...\n');
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
    // Test Suite 1: Categories & Suppliers Directory
    console.log('--- Test Suite 1: Categories & Suppliers Directory ---');
    const categories = await inventoryService.listCategories();
    assert(categories.length >= 6, 'Retrieves active inventory categories');
    assert(categories.some(c => c.code === 'MED-SUP'), 'Includes Medical Supplies category');
    assert(categories.some(c => c.code === 'SURG-OT'), 'Includes Surgical & OT category');
    assert(categories.some(c => c.code === 'BIOMED-EQ'), 'Includes Biomedical Equipment category');
    assert(categories.some(c => c.code === 'CLEAN'), 'Includes Cleaning Supplies category');

    const suppliers = await inventoryService.listSuppliers();
    assert(suppliers.length >= 5, 'Retrieves hospital suppliers directory');
    assert(suppliers.some(s => s.code === 'SUP-2026-001'), 'Includes Becton Dickinson (BD) MedTech');
    assert(suppliers.some(s => s.code === 'SUP-2026-003'), 'Includes Mindray Bio-Medical');

    const suppCode = `SUP-2026-OLY-${Math.floor(1000 + Math.random() * 9000)}`;
    const newSuppRes = await inventoryService.createSupplier({
      name: 'Olympus Surgical Endoscopy LLC',
      code: suppCode,
      contact_person: 'Dr. Frank Vance',
      phone: '+1 (800) 555-0922',
      email: 'sales@olympus-med.com',
      address: 'Center Valley, PA',
      payment_terms: 'Net 30 Days'
    });
    assert(newSuppRes.id > 0, 'New supplier created successfully');
    assert(newSuppRes.code === suppCode, 'Supplier code matches input');

    // Test Suite 2: Inventory Items Catalog & Multi-Type Management
    console.log('\n--- Test Suite 2: Inventory Items Catalog ---');
    const itemsRes = await inventoryService.listItems({ limit: 50 });
    assert(itemsRes.items.length >= 15, 'Retrieves active inventory items catalog from MySQL');
    assert(itemsRes.items.some(i => i.item_code === 'MED-SYR-001'), 'Includes 5ml Sterile Syringes');
    assert(itemsRes.items.some(i => i.item_code === 'EQ-MON-001'), 'Includes Vital Signs Monitor');
    assert(itemsRes.items.some(i => i.item_code === 'CLN-DIS-001'), 'Includes Hospital Grade Disinfectant');

    const searchRes = await inventoryService.listItems({ search: 'Cannula' });
    assert(searchRes.items.length >= 1, 'Search finds items by keyword');
    assert(searchRes.items[0].item_code === 'MED-CAN-002', 'Matched item is IV Cannula 20G');

    // Test Suite 3: Item Creation & Mandatory Initial Transaction
    console.log('\n--- Test Suite 3: Item Creation & Initial Transaction ---');
    const itemCode = `MED-OXY-${Math.floor(1000 + Math.random() * 9000)}`;
    const newItemRes = await inventoryService.createItem({
      category_id: 1,
      supplier_id: 1,
      item_code: itemCode,
      name: 'Oxygen Nasal Cannula (Adult 2.1m Tubing)',
      generic_spec: 'Soft curved prongs with universal crush-resistant connector',
      item_type: 'medical_supply',
      unit_of_measure: 'Pack (20 pcs)',
      current_stock: 50,
      min_stock_level: 15,
      max_stock_level: 200,
      unit_cost: 8.50,
      storage_location: 'Central Supply Bay B-2',
      batch_number: 'BAT-2026-OXY-01',
      expiry_date: '2029-12-31'
    }, mockAdmin);

    assert(newItemRes.id > 0, 'New inventory item created dynamically in MySQL');
    assert(newItemRes.current_stock === 50, 'Initial stock saved correctly');
    const createdItemId = newItemRes.id;

    // Verify mandatory audit transaction was recorded for initial stock intake
    const initialTxns = await inventoryService.listTransactions({ item_id: createdItemId });
    assert(initialTxns.length >= 1, 'MANDATORY AUDIT: Transaction logged for initial item intake');
    assert(initialTxns[0].transaction_type === 'stock_in_purchase', 'Initial transaction type is stock_in_purchase');
    assert(initialTxns[0].quantity === 50, 'Initial transaction quantity matches 50');

    // Test Suite 4: Stock-In (Receipt of Goods) Workflow
    console.log('\n--- Test Suite 4: Stock-In (Receipt of Goods) Workflow ---');
    const stockInRes = await inventoryService.processStockIn({
      item_id: createdItemId,
      quantity: 30,
      unit_cost: 8.50,
      batch_number: 'BAT-2026-OXY-01',
      notes: 'Direct supplier restock delivery intake'
    }, mockAdmin);

    assert(stockInRes.stock_after === 80, 'Stock successfully incremented from 50 to 80 (+30)');
    assert(stockInRes.transaction_number.startsWith('TXN-'), 'Unique transaction number generated');

    const txnsAfterStockIn = await inventoryService.listTransactions({ item_id: createdItemId });
    assert(txnsAfterStockIn[0].transaction_type === 'stock_in_purchase', 'Stock-in transaction logged in ledger');

    // Test Suite 5: Stock-Out (Departmental Issuance) Workflow
    console.log('\n--- Test Suite 5: Stock-Out (Departmental Issuance) Workflow ---');
    const stockOutRes = await inventoryService.processStockOut({
      item_id: createdItemId,
      quantity: 20,
      department_id: 1, // Cardiology
      issued_to_person: 'Charge Nurse Sarah (Cardiology Floor 2)',
      notes: 'Ward oxygen supply replenishment for CCU'
    }, mockAdmin);

    assert(stockOutRes.stock_after === 60, 'Stock successfully decremented from 80 to 60 (-20)');

    const txnsAfterStockOut = await inventoryService.listTransactions({ item_id: createdItemId });
    assert(txnsAfterStockOut[0].transaction_type === 'stock_out_issuance', 'Stock-out transaction logged in ledger');
    assert(txnsAfterStockOut[0].quantity === -20, 'Stock-out quantity recorded as negative (-20)');

    // Test Suite 6: Strict Negative Stock Rule Safeguard
    console.log('\n--- Test Suite 6: Strict Negative Stock Rule Safeguard ---');
    let negativeStockBlocked = false;
    try {
      await inventoryService.processStockOut({
        item_id: createdItemId,
        quantity: 9999, // Exceeds available stock of 60
        department_id: 1,
        notes: 'Excessive issuance test'
      }, mockAdmin);
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes('Insufficient stock')) {
        negativeStockBlocked = true;
      }
    }
    assert(negativeStockBlocked, 'BLOCKED: Stock-out exceeding current inventory is rejected with 400 Bad Request');

    const itemCheck = await inventoryService.getItemById(createdItemId);
    assert(itemCheck.current_stock === 60, 'Stock remained atomic and untouched at 60 after rollback');

    // Test Suite 7: Stock Adjustment & Audit Ledger
    console.log('\n--- Test Suite 7: Stock Adjustment & Physical Audit ---');
    const adjustRes = await inventoryService.processStockAdjustment({
      item_id: createdItemId,
      quantity_change: 5,
      reason: 'Physical count reconciliation surplus'
    }, mockAdmin);

    assert(adjustRes.stock_after === 65, 'Stock successfully adjusted from 60 to 65 (+5)');

    // Test Suite 8: Purchase Order Creation & Receiving Workflow
    console.log('\n--- Test Suite 8: Purchase Order Creation & Receiving Workflow ---');
    const createPoRes = await inventoryService.createPurchaseOrder({
      supplier_id: 1,
      order_date: '2026-08-16',
      expected_delivery_date: '2026-08-25',
      items: [
        { item_id: createdItemId, quantity_ordered: 50, unit_cost: 8.50 }
      ],
      notes: 'Urgent oxygen cannula bulk procurement'
    }, mockAdmin);

    assert(createPoRes.id > 0, 'Purchase Order created in MySQL');
    assert(createPoRes.po_number.startsWith('PO-'), 'Unique PO number generated (PO-YYYY-XXXXXX)');
    assert(createPoRes.total_amount > 0, 'Total PO amount calculated with tax');

    const poId = createPoRes.id;

    // Receive the Purchase Order and restock item
    const receivePoRes = await inventoryService.receivePurchaseOrder(poId, mockAdmin);
    assert(receivePoRes.status === 'received', 'Purchase Order marked as received');

    const itemAfterPoReceive = await inventoryService.getItemById(createdItemId);
    assert(itemAfterPoReceive.current_stock === 115, 'Item restocked from 65 to 115 (+50) upon PO receipt');

    const poTxns = await inventoryService.listTransactions({ item_id: createdItemId });
    assert(poTxns.some(t => t.reference_id === poId), 'PO Receipt generated linked inventory transaction');

    // Test Suite 9: Comprehensive Inventory Reports
    console.log('\n--- Test Suite 9: Comprehensive Inventory Reports ---');
    const reports = await inventoryService.getInventoryReports();
    assert(reports.stock_valuation_by_category.length >= 5, 'Report: Stock valuation grouped by category generated');
    assert(reports.low_stock_reorder_list.length >= 1, 'Report: Low stock reorder list generated');
    assert(reports.purchases_summary_by_supplier.length >= 1, 'Report: Purchases summary by supplier generated');
    assert(reports.departmental_consumption.length >= 1, 'Report: Departmental consumption breakdown generated');

    // Test Suite 10: Inventory KPIs & Statistics
    console.log('\n--- Test Suite 10: Inventory KPIs & Statistics ---');
    const stats = await inventoryService.getInventoryStats();
    assert(stats.total_items >= 15, 'Total inventory items calculated');
    assert(stats.total_inventory_valuation > 0, 'Total hospital inventory asset valuation calculated');
    assert(stats.total_transactions > 0, 'Total inventory transactions count calculated');

    // Clean up created test item, PO, and transactions
    await db.query('DELETE FROM inventory_transactions WHERE item_id = ?', [createdItemId]);
    await db.query('DELETE FROM inventory_po_items WHERE po_id = ?', [poId]);
    await db.query('DELETE FROM inventory_purchase_orders WHERE id = ?', [poId]);
    await db.query('DELETE FROM inventory_items WHERE id = ?', [createdItemId]);
    await db.query('DELETE FROM inventory_suppliers WHERE id = ?', [newSuppRes.id]);

    console.log('\n======================================================');
    console.log(`🏁 INVENTORY MODULE INTEGRATION TEST RESULTS:`);
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

runInventoryIntegrationTests();
