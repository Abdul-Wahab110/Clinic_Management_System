const db = require('../server/config/db');
const paymentService = require('../server/services/payment.service');
const billingService = require('../server/services/billing.service');

async function runPaymentIntegrationTests() {
  console.log('🧪 Starting Payment Management Module Integration Tests...\n');
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
  const mockNurse = { id: 6, role: 'nurse' };

  try {
    // Test Suite 1: Payment Methods Catalog
    console.log('--- Test Suite 1: Payment Methods Catalog ---');
    const methods = await paymentService.listPaymentMethods({});
    assert(methods.length >= 5, 'Retrieves configurable payment methods from MySQL');
    assert(methods.some(m => m.code === 'cash'), 'Includes Cash method');
    assert(methods.some(m => m.code === 'card'), 'Includes Card method');
    assert(methods.some(m => m.code === 'bank_transfer'), 'Includes Bank Transfer method');
    assert(methods.some(m => m.code === 'online'), 'Includes Online Portal method');
    assert(methods.some(m => m.code === 'insurance_claim'), 'Includes Insurance Claim method');

    // Create a new configurable payment method
    const newMethodRes = await paymentService.createPaymentMethod({
      code: 'corporate_voucher',
      name: 'Corporate Healthcare Voucher',
      category: 'other',
      requires_ref: 1,
      fee_percent: 0.00,
      description: 'Corporate employee healthcare voucher redemption'
    });
    assert(newMethodRes.id > 0, 'New dynamic payment method created in MySQL');
    assert(newMethodRes.code === 'corporate_voucher', 'Method code matches');

    // Test Suite 2: Partial & Multiple Payments Lifecycle
    console.log('\n--- Test Suite 2: Partial & Multiple Payments Lifecycle ---');
    // Create a fresh test invoice of $1000.00
    const invRes = await billingService.createInvoice({
      patient_id: 1,
      items: [
        { service_type: 'procedure', item_name: 'Minor Surgical Procedure', quantity: 1, unit_price: 1000.00 }
      ],
      discount_type: 'fixed',
      discount_rate: 0.00,
      tax_rate: 0.00, // Zero tax for clean round numbers in test
      billing_notes: 'Payment installment lifecycle testing invoice'
    }, mockAdmin);

    assert(invRes.id > 0, 'Test invoice of $1000.00 created');
    assert(invRes.remaining_amount === 1000.00, 'Initial remaining balance is $1000.00');
    assert(invRes.status === 'unpaid', 'Initial invoice status is UNPAID');

    // Installment 1: Partial Payment of $300.00
    const pay1 = await paymentService.recordPayment({
      invoice_id: invRes.id,
      amount_paid: 300.00,
      payment_method: 'cash',
      payer_name: 'Arthur Pendleton',
      notes: 'First installment cash deposit'
    }, mockAdmin, '127.0.0.1');

    assert(pay1.payment_id > 0, 'First partial payment recorded');
    assert(pay1.receipt_number.startsWith('REC-'), 'Unique Receipt Number generated (REC-YYYY-XXXXXX)');
    assert(pay1.total_paid === 300.00, 'Invoice total paid is $300.00');
    assert(pay1.remaining_amount === 700.00, 'Invoice remaining balance recalculated on backend to $700.00');
    assert(pay1.status === 'partially_paid', 'Invoice status transitioned to PARTIALLY_PAID');

    // Installment 2: Multiple Payments - Second Partial Payment of $400.00
    const pay2 = await paymentService.recordPayment({
      invoice_id: invRes.id,
      amount_paid: 400.00,
      payment_method: 'card',
      transaction_ref: 'TXN-VISA-99128',
      card_last_four: '4242',
      notes: 'Second installment via Visa card'
    }, mockAdmin, '127.0.0.1');

    assert(pay2.payment_id > 0, 'Second progressive payment recorded');
    assert(pay2.total_paid === 700.00, 'Invoice total paid is $700.00 (300 + 400)');
    assert(pay2.remaining_amount === 300.00, 'Invoice remaining balance recalculated on backend to $300.00');
    assert(pay2.status === 'partially_paid', 'Invoice status remains PARTIALLY_PAID');

    // Test Suite 3: Strict Overpayment Prevention
    console.log('\n--- Test Suite 3: Strict Overpayment Prevention ---');
    let overpayBlocked = false;
    try {
      await paymentService.recordPayment({
        invoice_id: invRes.id,
        amount_paid: 500.00 // Remaining is only 300.00
      }, mockAdmin);
    } catch (err) {
      overpayBlocked = true;
    }
    assert(overpayBlocked, 'BLOCKED: Attempt to overpay $500 on $300 balance rejected with 400 Bad Request');

    // Installment 3: Final Full Settlement of $300.00
    const pay3 = await paymentService.recordPayment({
      invoice_id: invRes.id,
      amount_paid: 300.00,
      payment_method: 'online',
      transaction_ref: 'ST-CH-882910',
      notes: 'Final balance paid online'
    }, mockAdmin, '127.0.0.1');

    assert(pay3.total_paid === 1000.00, 'Invoice total paid is $1000.00');
    assert(pay3.remaining_amount === 0.00, 'Invoice remaining balance is $0.00');
    assert(pay3.status === 'paid', 'Invoice status transitioned to PAID in full');

    // Test Suite 4: Payment Receipt Details & Patient Linking
    console.log('\n--- Test Suite 4: Payment Receipt Details & Patient Linking ---');
    const receipt = await paymentService.getPaymentById(pay2.payment_id);
    assert(receipt.id === pay2.payment_id, 'Receipt retrieved by ID');
    assert(receipt.invoice_number === invRes.invoice_number, 'Receipt linked to correct invoice');
    assert(receipt.card_last_four === '4242', 'Card last four digits attached to receipt');
    assert(receipt.hasOwnProperty('clinic_info'), 'Receipt includes hospital letterhead details');

    // Test Suite 5: Authorized Refunds Workflow
    console.log('\n--- Test Suite 5: Authorized Refunds Workflow ---');
    // Unauthorized user attempt
    let unauthRefundBlocked = false;
    try {
      await paymentService.processRefund({
        payment_id: pay2.payment_id,
        refund_amount: 100.00,
        refund_reason: 'Patient dispute'
      }, mockNurse);
    } catch (err) {
      unauthRefundBlocked = true;
    }
    assert(unauthRefundBlocked, 'BLOCKED: Non-authorized staff role cannot issue refunds (403 Forbidden)');

    // Authorized partial refund of $150.00 on pay2 ($400.00)
    const refundRes = await paymentService.processRefund({
      payment_id: pay2.payment_id,
      refund_amount: 150.00,
      refund_reason: 'Partial procedure adjustment approved by Medical Director',
      notes: 'Credited back to customer Visa card'
    }, mockAdmin, '127.0.0.1');

    assert(refundRes.refund_id > 0, 'Authorized refund processed');
    assert(refundRes.refund_number.startsWith('REF-'), 'Unique Refund Number generated (REF-YYYY-XXXXXX)');
    assert(refundRes.invoice_remaining_balance === 150.00, 'Invoice balance restored to $150.00 (1000 - 850)');
    assert(refundRes.invoice_status === 'partially_paid', 'Invoice status restored to PARTIALLY_PAID');

    // Attempt refund exceeding remaining refundable balance
    let excessRefundBlocked = false;
    try {
      await paymentService.processRefund({
        payment_id: pay2.payment_id,
        refund_amount: 300.00 // Available is only 400 - 150 = 250
      }, mockAdmin);
    } catch (err) {
      excessRefundBlocked = true;
    }
    assert(excessRefundBlocked, 'BLOCKED: Attempt to refund exceeding transaction paid amount rejected with 400 Bad Request');

    // Test Suite 6: Payment Audit Logs Ledger
    console.log('\n--- Test Suite 6: Payment Audit Logs Ledger ---');
    const auditLogs = await paymentService.getPaymentAuditLogs({ invoice_id: invRes.id });
    assert(auditLogs.length >= 4, 'Audit logs recorded for all payment installments and refund');
    assert(auditLogs.some(l => l.action_type === 'payment_recorded' || l.action_type === 'partial_payment'), 'Audit log contains partial payment action');
    assert(auditLogs.some(l => l.action_type === 'full_settlement'), 'Audit log contains full settlement action');
    assert(auditLogs.some(l => l.action_type === 'payment_refunded'), 'Audit log contains refund action');

    // Test Suite 7: Payment Statistics & Revenue Analytics
    console.log('\n--- Test Suite 7: Payment Statistics & Revenue Analytics ---');
    const payStats = await paymentService.getPaymentStats();
    assert(payStats.total_payments_count >= 3, 'Total payments calculated');
    assert(parseFloat(payStats.gross_collections) > 0, 'Gross collections calculated');
    assert(parseFloat(payStats.total_refunds) > 0, 'Total refunds calculated');
    assert(Array.isArray(payStats.methods_breakdown), 'Payment methods breakdown generated');

    // Clean up test records
    await db.query('DELETE FROM payment_audit_logs WHERE invoice_id = ?', [invRes.id]);
    await db.query('DELETE FROM payment_refunds WHERE invoice_id = ?', [invRes.id]);
    await db.query('DELETE FROM payments WHERE invoice_id = ?', [invRes.id]);
    await db.query('DELETE FROM invoice_items WHERE invoice_id = ?', [invRes.id]);
    await db.query('DELETE FROM invoices WHERE id = ?', [invRes.id]);
    await db.query('DELETE FROM payment_methods WHERE id = ?', [newMethodRes.id]);

    console.log('\n======================================================');
    console.log(`🏁 PAYMENT MODULE INTEGRATION TEST RESULTS:`);
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

runPaymentIntegrationTests();
