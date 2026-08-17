const db = require('../server/config/db');
const billingService = require('../server/services/billing.service');

async function runBillingIntegrationTests() {
  console.log('🧪 Starting Billing & Invoice Management Module Integration Tests...\n');
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
    // Test Suite 1: Billing Services Catalog
    console.log('--- Test Suite 1: Billing Services Catalog ---');
    const services = await billingService.listServices({});
    assert(services.length >= 10, 'Retrieves all hospital billing services across modalities');
    assert(services.some(s => s.service_type === 'consultation'), 'Includes consultation services');
    assert(services.some(s => s.service_type === 'laboratory'), 'Includes laboratory services');
    assert(services.some(s => s.service_type === 'radiology'), 'Includes radiology imaging services');
    assert(services.some(s => s.service_type === 'room_charge'), 'Includes inpatient room/bed charge services');
    assert(services.some(s => s.service_type === 'pharmacy'), 'Includes pharmacy medication services');
    assert(services.some(s => s.service_type === 'procedure'), 'Includes clinical procedure services');

    // Create a new billing service
    const newServiceRes = await billingService.createService({
      service_code: 'SRV-TEST-099',
      service_name: 'Continuous Holter Cardiac Telemetry Monitoring (24h)',
      service_type: 'procedure',
      standard_price: 220.00,
      tax_rate_percent: 5.00,
      description: '24-hour ambulatory cardiac rhythm recording'
    });
    assert(newServiceRes.id > 0, 'New dynamic billing service created in MySQL');
    assert(newServiceRes.service_code === 'SRV-TEST-099', 'Service code matches');

    // Test Suite 2: Multi-Item Invoice Creation & Backend Total Calculation
    console.log('\n--- Test Suite 2: Multi-Item Invoice Creation & Backend Total Calculation ---');
    // Items:
    // 1. Specialist Consultation: 1 * 150.00 = 150.00
    // 2. Chest CT Scan: 1 * 420.00 = 420.00
    // 3. CBC Lab Test: 2 * 35.00 = 70.00
    // 4. Inpatient ICU Bed: 2 * 450.00 = 900.00
    // Total Subtotal = 150 + 420 + 70 + 900 = 1540.00
    // Discount: 10% on 1540.00 = 154.00
    // Taxable Subtotal = 1540.00 - 154.00 = 1386.00
    // Tax: 5% on 1386.00 = 69.30
    // Net Amount = 1386.00 + 69.30 = 1455.30

    const invoiceData = {
      patient_id: 1,
      doctor_id: 1,
      department_id: 1,
      discount_type: 'percentage',
      discount_rate: 10.00,
      tax_rate: 5.00,
      billing_notes: 'Multidisciplinary Inpatient Cardiac & Diagnostic Care Package',
      items: [
        { service_type: 'consultation', item_name: 'Specialist Physician Consultation', quantity: 1, unit_price: 150.00 },
        { service_type: 'radiology', item_name: 'Non-Contrast CT Brain / Head Scan', quantity: 1, unit_price: 420.00 },
        { service_type: 'laboratory', item_name: 'Complete Blood Count (CBC)', quantity: 2, unit_price: 35.00 },
        { service_type: 'room_charge', item_name: 'Intensive Care Unit (ICU) Bed Stay', quantity: 2, unit_price: 450.00 }
      ]
    };

    const invRes = await billingService.createInvoice(invoiceData, mockAdmin);
    assert(invRes.id > 0, 'Multi-item invoice created in MySQL');
    assert(invRes.invoice_number.startsWith('INV-'), 'Unique Invoice Number generated (INV-YYYY-XXXXXX)');
    assert(invRes.subtotal === 1540.00, 'Calculated Subtotal ($1540.00) strictly verified on backend');
    assert(invRes.discount_amount === 154.00, 'Calculated 10% Discount ($154.00) strictly verified on backend');
    assert(invRes.tax_amount === 69.30, 'Calculated 5% Tax ($69.30) strictly verified on backend');
    assert(invRes.net_amount === 1455.30, 'Calculated Net Total ($1455.30) strictly verified on backend');
    assert(invRes.remaining_amount === 1455.30, 'Remaining Amount matches net total');
    assert(invRes.status === 'unpaid', 'Initial invoice status is UNPAID');

    // Test Suite 3: Invoice Retrieval & Letterhead Breakdown
    console.log('\n--- Test Suite 3: Invoice Retrieval & Letterhead Breakdown ---');
    const invoiceDetail = await billingService.getInvoiceById(invRes.id);
    assert(invoiceDetail.id === invRes.id, 'Invoice details retrieved by ID');
    assert(invoiceDetail.items.length === 4, 'Invoice contains all 4 itemized clinical charge lines');
    assert(invoiceDetail.items.some(i => i.service_type === 'room_charge'), 'Includes room charge item line');
    assert(invoiceDetail.hasOwnProperty('clinic_info'), 'Includes hospital official branding & tax ID for printable invoice');

    // Test Suite 4: Transactional Payment Processing & Status Transitions
    console.log('\n--- Test Suite 4: Transactional Payment Processing & Status Transitions ---');
    // 1. Partial Payment of $500.00
    const partialPayRes = await billingService.processPayment({
      invoice_id: invRes.id,
      amount_paid: 500.00,
      payment_method: 'credit_card',
      transaction_ref: 'TXN-CC-109281',
      notes: 'Initial partial payment via Mastercard'
    }, mockAdmin);

    assert(partialPayRes.payment_id > 0, 'Partial payment transaction recorded');
    assert(partialPayRes.receipt_number.startsWith('REC-'), 'Unique Receipt Number generated (REC-YYYY-XXXXXX)');
    assert(partialPayRes.total_paid === 500.00, 'Invoice total paid updated to $500.00');
    assert(partialPayRes.remaining_amount === 955.30, 'Invoice remaining balance updated to $955.30 (1455.30 - 500.00)');
    assert(partialPayRes.status === 'partially_paid', 'Invoice status transitioned to PARTIALLY_PAID');

    // 2. Attempt Overpayment (Should be blocked by backend)
    let overpaymentBlocked = false;
    try {
      await billingService.processPayment({
        invoice_id: invRes.id,
        amount_paid: 1200.00 // Exceeds remaining 955.30
      }, mockAdmin);
    } catch (err) {
      overpaymentBlocked = true;
    }
    assert(overpaymentBlocked, 'BLOCKED: Overpayment exceeding remaining balance rejected with 400 Bad Request');

    // 3. Final Settlement Payment of $955.30
    const finalPayRes = await billingService.processPayment({
      invoice_id: invRes.id,
      amount_paid: 955.30,
      payment_method: 'insurance_claim',
      transaction_ref: 'CLM-BLUECROSS-8821',
      notes: 'Insurance claim payout settlement'
    }, mockAdmin);

    assert(finalPayRes.total_paid === 1455.30, 'Invoice total paid updated to $1455.30');
    assert(finalPayRes.remaining_amount === 0.00, 'Invoice remaining balance is now $0.00');
    assert(finalPayRes.status === 'paid', 'Invoice status transitioned to PAID in full');

    // Test Suite 5: Invoice List & Search Filter
    console.log('\n--- Test Suite 5: Invoice List & Search Filter ---');
    const invList = await billingService.listInvoices({ status: 'paid' });
    assert(invList.invoices.length >= 1, 'Invoices list retrieved');
    assert(invList.invoices.some(i => i.id === invRes.id), 'Settled invoice present in paid invoices list');

    // Test Suite 6: Invoice Cancellation
    console.log('\n--- Test Suite 6: Invoice Cancellation ---');
    const dummyInv = await billingService.createInvoice({
      patient_id: 1,
      items: [{ item_name: 'Consultation', quantity: 1, unit_price: 100.00 }]
    }, mockAdmin);
    const cancelRes = await billingService.cancelInvoice(dummyInv.id, 'Entered in error by clerk', mockAdmin);
    assert(cancelRes.status === 'cancelled', 'Unpaid invoice cancelled successfully');

    // Test Suite 7: Comprehensive Billing Reports & KPIs
    console.log('\n--- Test Suite 7: Comprehensive Billing Reports & KPIs ---');
    const reports = await billingService.getBillingReports();
    assert(Array.isArray(reports.revenue_by_category), 'Revenue by category report generated');
    assert(Array.isArray(reports.collection_by_payment_method), 'Collections by payment method report generated');
    assert(Array.isArray(reports.outstanding_receivables), 'Outstanding receivables aging report generated');

    const stats = await billingService.getBillingStats();
    assert(stats.total_invoices >= 1, 'Total invoices calculated');
    assert(parseFloat(stats.total_invoiced_revenue) > 0, 'Total invoiced revenue calculated');
    assert(parseFloat(stats.total_collected_revenue) > 0, 'Total collected revenue calculated');

    // Clean up test records
    await db.query('DELETE FROM invoice_items WHERE invoice_id IN (?, ?)', [invRes.id, dummyInv.id]);
    await db.query('DELETE FROM payments WHERE invoice_id = ?', [invRes.id]);
    await db.query('DELETE FROM invoices WHERE id IN (?, ?)', [invRes.id, dummyInv.id]);
    await db.query('DELETE FROM billing_services WHERE id = ?', [newServiceRes.id]);

    console.log('\n======================================================');
    console.log(`🏁 BILLING MODULE INTEGRATION TEST RESULTS:`);
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

runBillingIntegrationTests();
