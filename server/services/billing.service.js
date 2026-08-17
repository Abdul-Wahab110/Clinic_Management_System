const db = require('../config/db');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');

/**
 * List Configurable Billing Services Catalog
 */
async function listServices(query = {}) {
  const { service_type, department_id, search, is_active } = query;
  const conditions = [];
  const params = [];

  if (is_active !== undefined) {
    conditions.push('bs.is_active = ?');
    params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
  }

  if (service_type && service_type !== 'all') {
    conditions.push('bs.service_type = ?');
    params.push(service_type);
  }

  if (department_id && department_id !== 'all') {
    conditions.push('bs.department_id = ?');
    params.push(parseInt(department_id, 10));
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(bs.service_name LIKE ? OR bs.service_code LIKE ?)');
    params.push(term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT 
      bs.*,
      d.name as department_name,
      d.code as department_code
    FROM billing_services bs
    LEFT JOIN departments d ON bs.department_id = d.id
    ${whereClause}
    ORDER BY bs.service_type ASC, bs.service_name ASC`,
    params
  );

  return rows;
}

/**
 * Create Billing Service
 */
async function createService(data) {
  const code = data.service_code.trim().toUpperCase();
  const [existing] = await db.query('SELECT id FROM billing_services WHERE service_code = ?', [code]);
  if (existing.length > 0) throw new ConflictError(`Billing service with code '${code}' already exists.`);

  const [res] = await db.query(
    `INSERT INTO billing_services 
     (service_code, service_name, service_type, department_id, standard_price, tax_rate_percent, description, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      code,
      data.service_name.trim(),
      data.service_type,
      data.department_id ? parseInt(data.department_id, 10) : null,
      parseFloat(data.standard_price || 0.00),
      parseFloat(data.tax_rate_percent || 5.00),
      data.description ? data.description.trim() : null
    ]
  );

  return {
    id: res.insertId,
    service_code: code,
    service_name: data.service_name,
    message: `Billing service '${data.service_name}' added successfully.`
  };
}

/**
 * Update Billing Service
 */
async function updateService(id, data) {
  const [existing] = await db.query('SELECT * FROM billing_services WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Billing service not found.');
  const cur = existing[0];

  await db.query(
    `UPDATE billing_services 
     SET service_name = ?,
         service_type = ?,
         department_id = ?,
         standard_price = ?,
         tax_rate_percent = ?,
         description = ?,
         is_active = ?
     WHERE id = ?`,
    [
      data.service_name !== undefined ? data.service_name.trim() : cur.service_name,
      data.service_type || cur.service_type,
      data.department_id !== undefined ? (data.department_id ? parseInt(data.department_id, 10) : null) : cur.department_id,
      data.standard_price !== undefined ? parseFloat(data.standard_price) : cur.standard_price,
      data.tax_rate_percent !== undefined ? parseFloat(data.tax_rate_percent) : cur.tax_rate_percent,
      data.description !== undefined ? data.description : cur.description,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : cur.is_active,
      id
    ]
  );

  return { id, message: 'Billing service updated successfully.' };
}

/**
 * List Invoices with Multi-Criteria Filtering
 */
async function listInvoices(query = {}) {
  const {
    status,
    patient_id,
    doctor_id,
    department_id,
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

  if (status && status !== 'all') {
    conditions.push('inv.status = ?');
    params.push(status);
  }

  if (patient_id) {
    conditions.push('inv.patient_id = ?');
    params.push(parseInt(patient_id, 10));
  }

  if (doctor_id && doctor_id !== 'all') {
    conditions.push('inv.doctor_id = ?');
    params.push(parseInt(doctor_id, 10));
  }

  if (department_id && department_id !== 'all') {
    conditions.push('inv.department_id = ?');
    params.push(parseInt(department_id, 10));
  }

  if (date_from) {
    conditions.push('inv.invoice_date >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('inv.invoice_date <= ?');
    params.push(date_to);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(inv.invoice_number LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ?)');
    params.push(term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) as total
    FROM invoices inv
    JOIN patients p ON inv.patient_id = p.id
    ${whereClause}
  `;
  const [countRows] = await db.query(countSql, params);
  const total = countRows[0].total;

  const dataSql = `
    SELECT 
      inv.*,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.phone as patient_phone,
      p.gender as patient_gender,
      d.name as department_name,
      doc_u.full_name as doctor_name,
      (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = inv.id) as items_count,
      (SELECT COUNT(*) FROM payments WHERE invoice_id = inv.id AND status = 'completed') as payments_count
    FROM invoices inv
    JOIN patients p ON inv.patient_id = p.id
    LEFT JOIN departments d ON inv.department_id = d.id
    LEFT JOIN doctors doc ON inv.doctor_id = doc.id
    LEFT JOIN users doc_u ON doc.user_id = doc_u.id
    ${whereClause}
    ORDER BY inv.created_at DESC, inv.id DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await db.query(dataSql, [...params, limitNum, offset]);

  return {
    invoices: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Get Invoice by ID with Itemized Charges, Payments History & Hospital Letterhead
 */
async function getInvoiceById(id) {
  const [rows] = await db.query(
    `SELECT 
      inv.*,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.phone as patient_phone,
      p.email as patient_email,
      p.address as patient_address,
      p.gender as patient_gender,
      p.blood_group as patient_blood_group,
      p.insurance_provider,
      p.insurance_policy_number,
      d.name as department_name,
      doc_u.full_name as doctor_name,
      adm.admission_number,
      adm.admission_date,
      u_cr.full_name as billed_by_name
    FROM invoices inv
    JOIN patients p ON inv.patient_id = p.id
    LEFT JOIN departments d ON inv.department_id = d.id
    LEFT JOIN doctors doc ON inv.doctor_id = doc.id
    LEFT JOIN users doc_u ON doc.user_id = doc_u.id
    LEFT JOIN ipd_admissions adm ON inv.admission_id = adm.id
    LEFT JOIN users u_cr ON inv.created_by = u_cr.id
    WHERE inv.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Invoice not found.');
  const invoice = rows[0];

  // Fetch line items
  const [items] = await db.query(
    `SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC`,
    [id]
  );

  // Fetch payment transactions
  const [payments] = await db.query(
    `SELECT pay.*, u.full_name as received_by_name
     FROM payments pay
     LEFT JOIN users u ON pay.received_by = u.id
     WHERE pay.invoice_id = ?
     ORDER BY pay.payment_date ASC`,
    [id]
  );

  return {
    ...invoice,
    items,
    payments,
    clinic_info: {
      name: 'AuraCare Multispecialty Hospital & Medical Center',
      address: '742 Evergreen Healthcare Boulevard, Medical District',
      phone: '+1 (800) 555-AURA (2872)',
      email: 'billing@auracare.com',
      tax_id: 'US-TAX-AURACARE-998811',
      accreditation: 'JCI & NABH Accredited Tertiary Care Center'
    }
  };
}

/**
 * Create Multi-Item Invoice with Strict Backend Calculation & Transactions
 */
async function createInvoice(data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const patientId = parseInt(data.patient_id, 10);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const invoiceDate = data.invoice_date || new Date().toISOString().split('T')[0];
    const dueDate = data.due_date || invoiceDate;

    // 1. Calculate Line Item Subtotals on Backend
    let calculatedSubtotal = 0;
    const resolvedItems = [];

    for (const item of data.items) {
      const qty = parseInt(item.quantity || 1, 10);
      const unitPrice = parseFloat(item.unit_price || 0.00);
      const lineSubtotal = parseFloat((qty * unitPrice).toFixed(2));
      calculatedSubtotal += lineSubtotal;

      resolvedItems.push({
        service_type: item.service_type || 'general_service',
        item_reference_id: item.item_reference_id ? parseInt(item.item_reference_id, 10) : null,
        item_name: item.item_name.trim(),
        item_description: item.item_description ? item.item_description.trim() : null,
        quantity: qty,
        unit_price: unitPrice,
        subtotal: lineSubtotal,
        discount_amount: 0.00,
        tax_amount: 0.00,
        total_price: lineSubtotal
      });
    }

    // 2. Calculate Discount on Backend
    let discountAmount = 0;
    const discountType = data.discount_type || 'fixed';
    const discountRate = parseFloat(data.discount_rate || 0.00);

    if (discountType === 'percentage' && discountRate > 0) {
      discountAmount = parseFloat(((calculatedSubtotal * discountRate) / 100).toFixed(2));
    } else if (data.discount_amount) {
      discountAmount = Math.min(calculatedSubtotal, parseFloat(data.discount_amount));
    }

    const taxableSubtotal = Math.max(0, parseFloat((calculatedSubtotal - discountAmount).toFixed(2)));

    // 3. Calculate Tax on Backend
    const taxRate = data.tax_rate !== undefined ? parseFloat(data.tax_rate) : 5.00;
    const taxAmount = parseFloat(((taxableSubtotal * taxRate) / 100).toFixed(2));

    // 4. Calculate Net Total Amount on Backend
    const netAmount = parseFloat((taxableSubtotal + taxAmount).toFixed(2));

    // 5. Initial Payment handling if provided
    let initialPaid = 0;
    if (data.initial_payment && parseFloat(data.initial_payment.amount_paid) > 0) {
      initialPaid = Math.min(netAmount, parseFloat(data.initial_payment.amount_paid));
    }

    const remainingAmount = parseFloat((netAmount - initialPaid).toFixed(2));

    let status = 'unpaid';
    if (remainingAmount <= 0) {
      status = 'paid';
    } else if (initialPaid > 0) {
      status = 'partially_paid';
    }

    // 6. Insert Master Invoice
    const [invRes] = await connection.query(
      `INSERT INTO invoices 
       (invoice_number, patient_id, appointment_id, admission_id, doctor_id, department_id, invoice_date, due_date, subtotal, discount_type, discount_rate, discount_amount, tax_rate, tax_amount, net_amount, paid_amount, remaining_amount, status, billing_notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber,
        patientId,
        data.appointment_id ? parseInt(data.appointment_id, 10) : null,
        data.admission_id ? parseInt(data.admission_id, 10) : null,
        data.doctor_id ? parseInt(data.doctor_id, 10) : null,
        data.department_id ? parseInt(data.department_id, 10) : null,
        invoiceDate,
        dueDate,
        calculatedSubtotal,
        discountType,
        discountRate,
        discountAmount,
        taxRate,
        taxAmount,
        netAmount,
        initialPaid,
        remainingAmount,
        status,
        data.billing_notes ? data.billing_notes.trim() : null,
        actorUser ? actorUser.id : 1
      ]
    );

    const invoiceId = invRes.insertId;

    // 7. Insert Invoice Items
    for (const it of resolvedItems) {
      await connection.query(
        `INSERT INTO invoice_items 
         (invoice_id, service_type, item_reference_id, item_name, item_description, quantity, unit_price, subtotal, discount_amount, tax_amount, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          it.service_type,
          it.item_reference_id,
          it.item_name,
          it.item_description,
          it.quantity,
          it.unit_price,
          it.subtotal,
          it.discount_amount,
          it.tax_amount,
          it.total_price
        ]
      );
    }

    // 8. If initial payment included, record payment receipt
    if (initialPaid > 0 && data.initial_payment) {
      const receiptNumber = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      await connection.query(
        `INSERT INTO payments 
         (receipt_number, invoice_id, patient_id, amount_paid, payment_method, transaction_ref, payment_date, received_by, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'completed')`,
        [
          receiptNumber,
          invoiceId,
          patientId,
          initialPaid,
          data.initial_payment.payment_method || 'cash',
          data.initial_payment.transaction_ref || null,
          actorUser ? actorUser.id : 1,
          data.initial_payment.notes || 'Initial payment on invoice creation'
        ]
      );
    }

    await connection.commit();

    return {
      id: invoiceId,
      invoice_number: invoiceNumber,
      subtotal: calculatedSubtotal,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      net_amount: netAmount,
      paid_amount: initialPaid,
      remaining_amount: remainingAmount,
      status,
      items_count: resolvedItems.length,
      message: `Invoice ${invoiceNumber} generated for $${netAmount.toFixed(2)} (${status.toUpperCase()}).`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Process Payment against an Invoice
 */
async function processPayment(data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const invoiceId = parseInt(data.invoice_id, 10);
    const amountToPay = parseFloat(data.amount_paid);

    if (amountToPay <= 0) throw new BadRequestError('Payment amount must be greater than zero.');

    const [invRows] = await connection.query('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [invoiceId]);
    if (invRows.length === 0) throw new NotFoundError('Invoice not found.');
    const inv = invRows[0];

    if (inv.status === 'paid') {
      throw new BadRequestError('Invoice has already been settled in full.');
    }
    if (inv.status === 'cancelled') {
      throw new BadRequestError('Cannot process payment on a cancelled invoice.');
    }

    const currentPaid = parseFloat(inv.paid_amount || 0.00);
    const netAmount = parseFloat(inv.net_amount);
    const currentRemaining = parseFloat(inv.remaining_amount);

    if (amountToPay > currentRemaining) {
      throw new BadRequestError(
        `Payment amount of $${amountToPay.toFixed(2)} exceeds remaining invoice balance of $${currentRemaining.toFixed(2)}.`
      );
    }

    const newPaid = parseFloat((currentPaid + amountToPay).toFixed(2));
    const newRemaining = parseFloat((netAmount - newPaid).toFixed(2));
    const newStatus = newRemaining <= 0 ? 'paid' : 'partially_paid';

    // 1. Generate Receipt Number
    const receiptNumber = `REC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // 2. Insert Payment Record
    const [payRes] = await connection.query(
      `INSERT INTO payments 
       (receipt_number, invoice_id, patient_id, amount_paid, payment_method, transaction_ref, payment_date, received_by, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'completed')`,
      [
        receiptNumber,
        invoiceId,
        inv.patient_id,
        amountToPay,
        data.payment_method || 'cash',
        data.transaction_ref ? data.transaction_ref.trim() : null,
        actorUser ? actorUser.id : 1,
        data.notes ? data.notes.trim() : 'Payment received'
      ]
    );

    // 3. Update Invoice Balance & Status
    await connection.query(
      `UPDATE invoices 
       SET paid_amount = ?, remaining_amount = ?, status = ? 
       WHERE id = ?`,
      [newPaid, newRemaining, newStatus, invoiceId]
    );

    await connection.commit();

    return {
      payment_id: payRes.insertId,
      receipt_number: receiptNumber,
      invoice_id: invoiceId,
      invoice_number: inv.invoice_number,
      amount_paid: amountToPay,
      total_paid: newPaid,
      remaining_amount: newRemaining,
      status: newStatus,
      message: `Payment of $${amountToPay.toFixed(2)} processed (Receipt: ${receiptNumber}). Outstanding: $${newRemaining.toFixed(2)}.`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Cancel Invoice
 */
async function cancelInvoice(id, reason, actorUser) {
  const [existing] = await db.query('SELECT * FROM invoices WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Invoice not found.');
  const inv = existing[0];

  if (inv.status === 'paid') {
    throw new BadRequestError('Cannot cancel a fully paid invoice. Process a refund instead.');
  }

  await db.query(
    "UPDATE invoices SET status = 'cancelled', billing_notes = CONCAT(COALESCE(billing_notes, ''), '\n[CANCELLED]: ', ?) WHERE id = ?",
    [reason ? reason.trim() : 'Cancelled by administrator', id]
  );

  return { id, status: 'cancelled', message: `Invoice ${inv.invoice_number} marked as cancelled.` };
}

/**
 * Comprehensive Billing & Revenue Reports
 */
async function getBillingReports() {
  // 1. Revenue by Service Category
  const [revByCategory] = await db.query(`
    SELECT 
      ii.service_type,
      COUNT(ii.id) as total_line_items,
      SUM(ii.quantity) as total_units_rendered,
      SUM(ii.total_price) as gross_revenue
    FROM invoice_items ii
    JOIN invoices inv ON ii.invoice_id = inv.id
    WHERE inv.status != 'cancelled'
    GROUP BY ii.service_type
    ORDER BY gross_revenue DESC
  `);

  // 2. Revenue Collection by Payment Method
  const [revByMethod] = await db.query(`
    SELECT 
      payment_method,
      COUNT(id) as total_transactions,
      SUM(amount_paid) as total_collected
    FROM payments
    WHERE status = 'completed'
    GROUP BY payment_method
    ORDER BY total_collected DESC
  `);

  // 3. Outstanding Receivables Aging
  const [agingReport] = await db.query(`
    SELECT 
      inv.id,
      inv.invoice_number,
      p.patient_code,
      p.first_name,
      p.last_name,
      inv.invoice_date,
      inv.net_amount,
      inv.paid_amount,
      inv.remaining_amount,
      DATEDIFF(CURDATE(), inv.invoice_date) as days_overdue,
      inv.status
    FROM invoices inv
    JOIN patients p ON inv.patient_id = p.id
    WHERE inv.remaining_amount > 0 AND inv.status IN ('unpaid', 'partially_paid')
    ORDER BY inv.remaining_amount DESC
    LIMIT 20
  `);

  return {
    revenue_by_category: revByCategory,
    collection_by_payment_method: revByMethod,
    outstanding_receivables: agingReport
  };
}

/**
 * Hospital Billing Statistics & KPIs
 */
async function getBillingStats() {
  const [invStats] = await db.query(`
    SELECT 
      COUNT(*) as total_invoices,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_invoices_count,
      SUM(CASE WHEN status = 'partially_paid' THEN 1 ELSE 0 END) as partially_paid_count,
      SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_invoices_count,
      COALESCE(SUM(net_amount), 0) as total_invoiced_revenue,
      COALESCE(SUM(paid_amount), 0) as total_collected_revenue,
      COALESCE(SUM(remaining_amount), 0) as total_outstanding_receivables
    FROM invoices
    WHERE status != 'cancelled'
  `);

  const [todayPay] = await db.query(`
    SELECT 
      COALESCE(SUM(amount_paid), 0) as revenue_collected_today,
      COUNT(*) as payments_today_count
    FROM payments
    WHERE status = 'completed' AND DATE(payment_date) = CURDATE()
  `);

  return {
    ...invStats[0],
    ...todayPay[0]
  };
}

module.exports = {
  listServices,
  createService,
  updateService,
  listInvoices,
  getInvoiceById,
  createInvoice,
  processPayment,
  cancelInvoice,
  getBillingReports,
  getBillingStats
};
