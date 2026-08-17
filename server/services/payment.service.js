const db = require('../config/db');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../utils/errors');

/**
 * List Configurable Payment Methods
 */
async function listPaymentMethods(query = {}) {
  const { is_active } = query;
  const conditions = [];
  const params = [];

  if (is_active !== undefined) {
    conditions.push('is_active = ?');
    params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await db.query(`SELECT * FROM payment_methods ${whereClause} ORDER BY name ASC`, params);
  return rows;
}

/**
 * Create Payment Method
 */
async function createPaymentMethod(data) {
  const code = data.code.trim().toLowerCase().replace(/\s+/g, '_');
  const [existing] = await db.query('SELECT id FROM payment_methods WHERE code = ?', [code]);
  if (existing.length > 0) throw new ConflictError(`Payment method with code '${code}' already exists.`);

  const [res] = await db.query(
    `INSERT INTO payment_methods 
     (code, name, category, requires_ref, fee_percent, description, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [
      code,
      data.name.trim(),
      data.category || 'other',
      data.requires_ref ? 1 : 0,
      parseFloat(data.fee_percent || 0.00),
      data.description ? data.description.trim() : null
    ]
  );

  return { id: res.insertId, code, name: data.name, message: 'Payment method created successfully.' };
}

/**
 * Update Payment Method
 */
async function updatePaymentMethod(id, data) {
  const [existing] = await db.query('SELECT * FROM payment_methods WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Payment method not found.');
  const cur = existing[0];

  await db.query(
    `UPDATE payment_methods 
     SET name = ?,
         category = ?,
         requires_ref = ?,
         fee_percent = ?,
         description = ?,
         is_active = ?
     WHERE id = ?`,
    [
      data.name !== undefined ? data.name.trim() : cur.name,
      data.category || cur.category,
      data.requires_ref !== undefined ? (data.requires_ref ? 1 : 0) : cur.requires_ref,
      data.fee_percent !== undefined ? parseFloat(data.fee_percent) : cur.fee_percent,
      data.description !== undefined ? data.description : cur.description,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : cur.is_active,
      id
    ]
  );

  return { id, message: 'Payment method updated successfully.' };
}

/**
 * List Payment Transactions Ledger with Multi-Criteria Filtering
 */
async function listPayments(query = {}) {
  const {
    payment_method,
    patient_id,
    invoice_id,
    status,
    date_from,
    date_to,
    search,
    page = 1,
    limit = 50
  } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  if (payment_method && payment_method !== 'all') {
    conditions.push('pay.payment_method = ?');
    params.push(payment_method);
  }

  if (patient_id) {
    conditions.push('pay.patient_id = ?');
    params.push(parseInt(patient_id, 10));
  }

  if (invoice_id) {
    conditions.push('pay.invoice_id = ?');
    params.push(parseInt(invoice_id, 10));
  }

  if (status && status !== 'all') {
    conditions.push('pay.status = ?');
    params.push(status);
  }

  if (date_from) {
    conditions.push('DATE(pay.payment_date) >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('DATE(pay.payment_date) <= ?');
    params.push(date_to);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(pay.receipt_number LIKE ? OR inv.invoice_number LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR pay.transaction_ref LIKE ?)');
    params.push(term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total
     FROM payments pay
     JOIN invoices inv ON pay.invoice_id = inv.id
     JOIN patients p ON pay.patient_id = p.id
     ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await db.query(
    `SELECT 
      pay.*,
      inv.invoice_number,
      inv.net_amount as invoice_net_amount,
      inv.remaining_amount as invoice_remaining_amount,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.phone as patient_phone,
      u.full_name as received_by_name
    FROM payments pay
    JOIN invoices inv ON pay.invoice_id = inv.id
    JOIN patients p ON pay.patient_id = p.id
    LEFT JOIN users u ON pay.received_by = u.id
    ${whereClause}
    ORDER BY pay.payment_date DESC, pay.id DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    payments: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Get Detailed Payment Receipt with Patient & Clinic Info
 */
async function getPaymentById(id) {
  const [rows] = await db.query(
    `SELECT 
      pay.*,
      inv.invoice_number,
      inv.invoice_date,
      inv.net_amount as invoice_total,
      inv.paid_amount as invoice_total_paid,
      inv.remaining_amount as invoice_remaining_balance,
      inv.status as invoice_status,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.phone as patient_phone,
      p.gender as patient_gender,
      p.address as patient_address,
      u.full_name as cashier_name
    FROM payments pay
    JOIN invoices inv ON pay.invoice_id = inv.id
    JOIN patients p ON pay.patient_id = p.id
    LEFT JOIN users u ON pay.received_by = u.id
    WHERE pay.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Payment receipt not found.');
  const payment = rows[0];

  // Fetch linked refunds if any
  const [refunds] = await db.query(
    `SELECT pr.*, u.full_name as authorized_by_name
     FROM payment_refunds pr
     LEFT JOIN users u ON pr.authorized_by = u.id
     WHERE pr.payment_id = ?
     ORDER BY pr.refund_date DESC`,
    [id]
  );

  return {
    ...payment,
    refunds,
    clinic_info: {
      name: 'AuraCare Multispecialty Hospital',
      address: '742 Evergreen Healthcare Boulevard, Medical District',
      phone: '+1 (800) 555-AURA (2872)',
      email: 'billing@auracare.com',
      tax_id: 'US-TAX-AURACARE-998811',
      accreditation: 'JCI & NABH Accredited Tertiary Care Center'
    }
  };
}

/**
 * Record Payment against an Invoice (Strict Overpayment Prevention & Audit Logging)
 */
async function recordPayment(data, actorUser, ipAddress = null) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const invoiceId = parseInt(data.invoice_id, 10);
    const amountToPay = parseFloat(data.amount_paid);

    if (isNaN(amountToPay) || amountToPay <= 0) {
      throw new BadRequestError('Payment amount must be greater than zero.');
    }

    // Lock Invoice FOR UPDATE
    const [invRows] = await connection.query(
      'SELECT * FROM invoices WHERE id = ? FOR UPDATE',
      [invoiceId]
    );
    if (invRows.length === 0) throw new NotFoundError('Linked invoice not found.');
    const inv = invRows[0];

    if (inv.status === 'paid') {
      throw new BadRequestError('Invoice has already been settled in full.');
    }
    if (inv.status === 'cancelled') {
      throw new BadRequestError('Cannot post payment to a cancelled invoice.');
    }

    const currentPaid = parseFloat(inv.paid_amount || 0.00);
    const netAmount = parseFloat(inv.net_amount);
    const currentRemaining = parseFloat(inv.remaining_amount);

    // Strict Overpayment Prevention
    if (amountToPay > currentRemaining) {
      throw new BadRequestError(
        `Payment amount of $${amountToPay.toFixed(2)} exceeds remaining invoice balance of $${currentRemaining.toFixed(2)}.`
      );
    }

    const newPaid = parseFloat((currentPaid + amountToPay).toFixed(2));
    const newRemaining = parseFloat((netAmount - newPaid).toFixed(2));
    const isFullSettlement = newRemaining <= 0;
    const newStatus = isFullSettlement ? 'paid' : 'partially_paid';

    // 1. Generate Unique Receipt Number
    const receiptNumber = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // 2. Insert Payment Record
    const [payRes] = await connection.query(
      `INSERT INTO payments 
       (receipt_number, invoice_id, patient_id, amount_paid, payment_method, transaction_ref, payer_name, payer_phone, card_last_four, payment_date, received_by, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'completed')`,
      [
        receiptNumber,
        invoiceId,
        inv.patient_id,
        amountToPay,
        data.payment_method,
        data.transaction_ref ? data.transaction_ref.trim() : null,
        data.payer_name ? data.payer_name.trim() : null,
        data.payer_phone ? data.payer_phone.trim() : null,
        data.card_last_four ? data.card_last_four.trim() : null,
        actorUser ? actorUser.id : 1,
        data.notes ? data.notes.trim() : 'Payment received'
      ]
    );

    const paymentId = payRes.insertId;

    // 3. Update Invoice Balance & Status in MySQL
    await connection.query(
      `UPDATE invoices 
       SET paid_amount = ?, remaining_amount = ?, status = ? 
       WHERE id = ?`,
      [newPaid, newRemaining, newStatus, invoiceId]
    );

    // 4. Create Audit Log for Payment Action
    const actionType = isFullSettlement ? 'full_settlement' : (currentPaid > 0 ? 'partial_payment' : 'payment_recorded');
    await connection.query(
      `INSERT INTO payment_audit_logs 
       (payment_id, invoice_id, action_type, amount, actor_user_id, actor_role, ip_address, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        invoiceId,
        actionType,
        amountToPay,
        actorUser ? actorUser.id : 1,
        actorUser ? actorUser.role : 'hospital_admin',
        ipAddress,
        JSON.stringify({
          receipt_number: receiptNumber,
          invoice_number: inv.invoice_number,
          payment_method: data.payment_method,
          transaction_ref: data.transaction_ref || null,
          previous_balance: currentRemaining,
          new_balance: newRemaining,
          invoice_status: newStatus
        })
      ]
    );

    await connection.commit();

    return {
      payment_id: paymentId,
      receipt_number: receiptNumber,
      invoice_id: invoiceId,
      invoice_number: inv.invoice_number,
      amount_paid: amountToPay,
      total_paid: newPaid,
      remaining_amount: newRemaining,
      status: newStatus,
      message: `Payment of $${amountToPay.toFixed(2)} recorded (Receipt: ${receiptNumber}). Outstanding: $${newRemaining.toFixed(2)}.`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Process Authorized Refund against a Payment
 */
async function processRefund(data, actorUser, ipAddress = null) {
  // Enforce role authorization
  if (actorUser && !['super_admin', 'hospital_admin', 'accountant'].includes(actorUser.role)) {
    throw new ForbiddenError('Unauthorized: Only Financial Administrators and Accountants can authorize payment refunds.');
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const paymentId = parseInt(data.payment_id, 10);
    const refundAmount = parseFloat(data.refund_amount);

    if (isNaN(refundAmount) || refundAmount <= 0) {
      throw new BadRequestError('Refund amount must be greater than zero.');
    }

    // Lock Payment FOR UPDATE
    const [payRows] = await connection.query(
      'SELECT * FROM payments WHERE id = ? FOR UPDATE',
      [paymentId]
    );
    if (payRows.length === 0) throw new NotFoundError('Payment transaction not found.');
    const pay = payRows[0];

    const currentRefunded = parseFloat(pay.refunded_amount || 0.00);
    const amountPaid = parseFloat(pay.amount_paid);
    const availableForRefund = parseFloat((amountPaid - currentRefunded).toFixed(2));

    if (refundAmount > availableForRefund) {
      throw new BadRequestError(
        `Refund amount of $${refundAmount.toFixed(2)} exceeds refundable amount of $${availableForRefund.toFixed(2)}.`
      );
    }

    // Lock Invoice FOR UPDATE
    const [invRows] = await connection.query(
      'SELECT * FROM invoices WHERE id = ? FOR UPDATE',
      [pay.invoice_id]
    );
    if (invRows.length === 0) throw new NotFoundError('Associated invoice not found.');
    const inv = invRows[0];

    // 1. Generate Unique Refund Number
    const refundNumber = `REF-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // 2. Insert Refund Record
    const [refRes] = await connection.query(
      `INSERT INTO payment_refunds 
       (refund_number, payment_id, invoice_id, patient_id, refund_amount, refund_method, refund_reason, authorized_by, refund_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'processed', ?)`,
      [
        refundNumber,
        paymentId,
        pay.invoice_id,
        pay.patient_id,
        refundAmount,
        data.refund_method || pay.payment_method,
        data.refund_reason.trim(),
        actorUser ? actorUser.id : 1,
        data.notes ? data.notes.trim() : null
      ]
    );

    // 3. Update Payment Row
    const newRefundedTotal = parseFloat((currentRefunded + refundAmount).toFixed(2));
    const isFullRefund = newRefundedTotal >= amountPaid;
    await connection.query(
      `UPDATE payments 
       SET refunded_amount = ?, status = ? 
       WHERE id = ?`,
      [newRefundedTotal, isFullRefund ? 'refunded' : 'completed', paymentId]
    );

    // 4. Recalculate Invoice Balances
    const newInvoicePaid = Math.max(0, parseFloat((parseFloat(inv.paid_amount) - refundAmount).toFixed(2)));
    const newInvoiceRemaining = parseFloat((parseFloat(inv.net_amount) - newInvoicePaid).toFixed(2));
    let newInvoiceStatus = 'partially_paid';
    if (newInvoicePaid <= 0) {
      newInvoiceStatus = 'unpaid';
    } else if (newInvoiceRemaining <= 0) {
      newInvoiceStatus = 'paid';
    }

    await connection.query(
      `UPDATE invoices 
       SET paid_amount = ?, remaining_amount = ?, status = ? 
       WHERE id = ?`,
      [newInvoicePaid, newInvoiceRemaining, newInvoiceStatus, pay.invoice_id]
    );

    // 5. Create Audit Log for Refund Action
    await connection.query(
      `INSERT INTO payment_audit_logs 
       (payment_id, invoice_id, action_type, amount, actor_user_id, actor_role, ip_address, details)
       VALUES (?, ?, 'payment_refunded', ?, ?, ?, ?, ?)`,
      [
        paymentId,
        pay.invoice_id,
        refundAmount,
        actorUser ? actorUser.id : 1,
        actorUser ? actorUser.role : 'hospital_admin',
        ipAddress,
        JSON.stringify({
          refund_number: refundNumber,
          receipt_number: pay.receipt_number,
          refund_reason: data.refund_reason,
          restored_invoice_balance: newInvoiceRemaining,
          invoice_status: newInvoiceStatus
        })
      ]
    );

    await connection.commit();

    return {
      refund_id: refRes.insertId,
      refund_number: refundNumber,
      payment_id: paymentId,
      refund_amount: refundAmount,
      invoice_remaining_balance: newInvoiceRemaining,
      invoice_status: newInvoiceStatus,
      message: `Refund of $${refundAmount.toFixed(2)} processed successfully (Refund #${refundNumber}).`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get Payment Audit Logs
 */
async function getPaymentAuditLogs(query = {}) {
  const { invoice_id, payment_id, action_type, limit = 50 } = query;
  const conditions = [];
  const params = [];

  if (invoice_id) {
    conditions.push('pal.invoice_id = ?');
    params.push(parseInt(invoice_id, 10));
  }
  if (payment_id) {
    conditions.push('pal.payment_id = ?');
    params.push(parseInt(payment_id, 10));
  }
  if (action_type && action_type !== 'all') {
    conditions.push('pal.action_type = ?');
    params.push(action_type);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT 
      pal.*,
      u.full_name as actor_user_name,
      inv.invoice_number
    FROM payment_audit_logs pal
    JOIN invoices inv ON pal.invoice_id = inv.id
    LEFT JOIN users u ON pal.actor_user_id = u.id
    ${whereClause}
    ORDER BY pal.created_at DESC
    LIMIT ?`,
    [...params, Math.min(100, parseInt(limit, 10) || 50)]
  );

  return rows;
}

/**
 * Get Payment Statistics & Analytics
 */
async function getPaymentStats() {
  const [payStats] = await db.query(`
    SELECT 
      COUNT(*) as total_payments_count,
      COALESCE(SUM(amount_paid), 0) as gross_collections,
      COALESCE(SUM(refunded_amount), 0) as total_refunds,
      COALESCE(SUM(amount_paid - refunded_amount), 0) as net_collections
    FROM payments
  `);

  const [todayStats] = await db.query(`
    SELECT 
      COUNT(*) as payments_today_count,
      COALESCE(SUM(amount_paid), 0) as collections_today
    FROM payments
    WHERE DATE(payment_date) = CURDATE()
  `);

  const [methodBreakdown] = await db.query(`
    SELECT 
      payment_method,
      COUNT(id) as count,
      SUM(amount_paid) as total
    FROM payments
    GROUP BY payment_method
    ORDER BY total DESC
  `);

  return {
    ...payStats[0],
    ...todayStats[0],
    methods_breakdown: methodBreakdown
  };
}

module.exports = {
  listPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  listPayments,
  getPaymentById,
  recordPayment,
  processRefund,
  getPaymentAuditLogs,
  getPaymentStats
};
