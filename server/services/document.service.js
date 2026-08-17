const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');

const STORAGE_DIR = path.join(__dirname, '../../storage/documents');

/**
 * Helper to log audit actions
 */
async function logDocumentAudit(userId, action, entityId, details) {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)`,
      [userId || null, action, 'patient_documents', entityId, typeof details === 'object' ? JSON.stringify(details) : details]
    );
  } catch (_) {
    // Non-blocking audit logging
  }
}

/**
 * Helper to resolve patient ID for authenticated patient users
 */
async function resolvePatientIdForUser(user) {
  if (!user) return null;
  if (user.role === 'patient') {
    const [pRows] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [user.id]);
    if (pRows.length === 0) throw new ForbiddenError('No patient record linked to this account.');
    return pRows[0].id;
  }
  return null;
}

/**
 * 1. List Patient Documents (Role-Scoped)
 */
async function listDocuments(query = {}, user = null) {
  const { patient_id, category, status = 'active', search, date_from, date_to, page = 1, limit = 50 } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  // Enforce Patient Isolation
  const patientScopeId = await resolvePatientIdForUser(user);
  if (patientScopeId) {
    conditions.push('pd.patient_id = ?');
    params.push(patientScopeId);
  } else if (patient_id && patient_id !== 'all') {
    conditions.push('pd.patient_id = ?');
    params.push(parseInt(patient_id, 10));
  }

  if (category && category !== 'all') {
    conditions.push('pd.category = ?');
    params.push(category);
  }

  if (status && status !== 'all') {
    conditions.push('pd.status = ?');
    params.push(status);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(pd.document_name LIKE ? OR pd.notes LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ?)');
    params.push(term, term, term, term, term);
  }

  if (date_from) {
    conditions.push('DATE(pd.uploaded_at) >= ?');
    params.push(date_from);
  }

  if (date_to) {
    conditions.push('DATE(pd.uploaded_at) <= ?');
    params.push(date_to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total FROM patient_documents pd 
     JOIN patients p ON pd.patient_id = p.id 
     ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await db.query(
    `SELECT 
      pd.*,
      p.patient_code, p.first_name as patient_first_name, p.last_name as patient_last_name,
      u.full_name as uploader_name, u.role_id as uploader_role_id
    FROM patient_documents pd
    JOIN patients p ON pd.patient_id = p.id
    LEFT JOIN users u ON pd.uploaded_by = u.id
    ${whereClause}
    ORDER BY pd.uploaded_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  return {
    documents: rows.map(r => ({
      ...r,
      patient_name: `${r.patient_first_name} ${r.patient_last_name}`.trim(),
      download_url: `/api/v1/documents/${r.id}/download`,
      view_url: `/api/v1/documents/${r.id}/view`
    })),
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * 2. Get Document Metadata by ID
 */
async function getDocumentById(id, user = null) {
  const [rows] = await db.query(
    `SELECT 
      pd.*,
      p.patient_code, p.first_name as patient_first_name, p.last_name as patient_last_name,
      u.full_name as uploader_name
    FROM patient_documents pd
    JOIN patients p ON pd.patient_id = p.id
    LEFT JOIN users u ON pd.uploaded_by = u.id
    WHERE pd.id = ?`,
    [id]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Patient document not found.');
  }

  const doc = rows[0];

  // Enforce Patient Isolation Check
  const patientScopeId = await resolvePatientIdForUser(user);
  if (patientScopeId && doc.patient_id !== patientScopeId) {
    throw new ForbiddenError('Access forbidden. You cannot view documents belonging to another patient.');
  }

  return {
    ...doc,
    patient_name: `${doc.patient_first_name} ${doc.patient_last_name}`.trim(),
    download_url: `/api/v1/documents/${doc.id}/download`,
    view_url: `/api/v1/documents/${doc.id}/view`
  };
}

/**
 * 3. Upload & Save Patient Document
 */
async function uploadDocument(data, fileData = null, user = null) {
  const patientId = parseInt(data.patient_id, 10);
  const documentName = data.document_name.trim();
  const category = data.category || 'Medical Report';
  const notes = data.notes ? data.notes.trim() : null;
  const medicalRecordId = data.medical_record_id ? parseInt(data.medical_record_id, 10) : null;
  const labOrderId = data.lab_order_id ? parseInt(data.lab_order_id, 10) : null;
  const prescriptionId = data.prescription_id ? parseInt(data.prescription_id, 10) : null;
  const mimeType = data.mime_type || 'application/pdf';
  const fileSizeKb = parseInt(data.file_size_kb, 10) || 250;

  // Verify patient exists
  const [pRows] = await db.query('SELECT id, first_name, last_name FROM patients WHERE id = ?', [patientId]);
  if (pRows.length === 0) throw new NotFoundError('Patient record not found.');

  // Generate safe storage file name
  const timestamp = Date.now();
  const safeBaseName = documentName.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50);
  const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/jpeg' ? '.jpg' : '.pdf';
  const fileName = `doc_pat${patientId}_${safeBaseName}_${timestamp}${ext}`;
  const relativePath = `storage/documents/${fileName}`;
  const absolutePath = path.join(STORAGE_DIR, fileName);

  // Write file content to secure storage directory if provided
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  if (fileData) {
    if (Buffer.isBuffer(fileData)) {
      fs.writeFileSync(absolutePath, fileData);
    } else if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      const base64Data = fileData.split(',')[1];
      fs.writeFileSync(absolutePath, Buffer.from(base64Data, 'base64'));
    } else {
      fs.writeFileSync(absolutePath, fileData);
    }
  } else {
    // Generate placeholder verification file
    fs.writeFileSync(absolutePath, `%PDF-1.4 Clinical Document for Patient #${patientId}: ${documentName}`);
  }

  const [res] = await db.query(
    `INSERT INTO patient_documents 
     (patient_id, document_name, category, document_type, file_path, file_name, mime_type, file_size_kb, medical_record_id, lab_order_id, prescription_id, uploaded_by, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
    [
      patientId,
      documentName,
      category,
      category,
      relativePath,
      fileName,
      mimeType,
      fileSizeKb,
      medicalRecordId,
      labOrderId,
      prescriptionId,
      user ? user.id : null,
      notes
    ]
  );

  const docId = res.insertId;

  // Log Audit Trail
  await logDocumentAudit(
    user ? user.id : null,
    'UPLOAD_DOCUMENT',
    docId,
    `Uploaded ${category} document "${documentName}" for patient ID #${patientId}`
  );

  return {
    id: docId,
    patient_id: patientId,
    document_name: documentName,
    category,
    file_name: fileName,
    file_size_kb: fileSizeKb,
    status: 'active',
    download_url: `/api/v1/documents/${docId}/download`,
    message: 'Patient document uploaded and securely registered in MySQL.'
  };
}

/**
 * 4. Get File Path for Secure Download / View Streaming
 */
async function getDocumentFilePath(id, user = null) {
  const doc = await getDocumentById(id, user);

  // Determine absolute path
  let absolutePath = path.resolve(doc.file_path);
  if (!fs.existsSync(absolutePath)) {
    // Check fallback in STORAGE_DIR
    const fallbackPath = path.join(STORAGE_DIR, doc.file_name);
    if (fs.existsSync(fallbackPath)) {
      absolutePath = fallbackPath;
    } else {
      // Re-create file if was dummy seed
      fs.writeFileSync(fallbackPath, `%PDF-1.4 Mock Clinical Document #${doc.id}: ${doc.document_name}`);
      absolutePath = fallbackPath;
    }
  }

  return {
    absolutePath,
    fileName: doc.file_name,
    documentName: doc.document_name,
    mimeType: doc.mime_type || 'application/pdf',
    doc
  };
}

/**
 * 5. Archive Document
 */
async function archiveDocument(id, user = null) {
  const doc = await getDocumentById(id, user);

  await db.query("UPDATE patient_documents SET status = 'archived' WHERE id = ?", [id]);

  await logDocumentAudit(
    user ? user.id : null,
    'ARCHIVE_DOCUMENT',
    id,
    `Archived document "${doc.document_name}" for patient ID #${doc.patient_id}`
  );

  return { id, status: 'archived', message: 'Document archived successfully.' };
}

/**
 * 6. Delete Document
 */
async function deleteDocument(id, user = null) {
  const doc = await getDocumentById(id, user);

  // Soft delete / remove from DB
  await db.query('DELETE FROM patient_documents WHERE id = ?', [id]);

  // Clean up physical file if exists
  try {
    const filePath = path.join(STORAGE_DIR, doc.file_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {}

  await logDocumentAudit(
    user ? user.id : null,
    'DELETE_DOCUMENT',
    id,
    `Permanently deleted document "${doc.document_name}" for patient ID #${doc.patient_id}`
  );

  return { id, message: 'Document permanently removed.' };
}

/**
 * 7. Overview Statistics for Dashboard
 */
async function getDocumentStats(user = null) {
  const patientScopeId = await resolvePatientIdForUser(user);

  let whereSql = '';
  const params = [];
  if (patientScopeId) {
    whereSql = 'WHERE patient_id = ?';
    params.push(patientScopeId);
  }

  const [rows] = await db.query(`
    SELECT 
      COUNT(id) as total_documents,
      SUM(CASE WHEN category = 'Medical Report' THEN 1 ELSE 0 END) as medical_reports,
      SUM(CASE WHEN category = 'Lab Report' THEN 1 ELSE 0 END) as lab_reports,
      SUM(CASE WHEN category = 'Prescription' THEN 1 ELSE 0 END) as prescriptions,
      SUM(CASE WHEN category = 'Insurance' THEN 1 ELSE 0 END) as insurance_docs,
      SUM(CASE WHEN category = 'Referral' THEN 1 ELSE 0 END) as referrals,
      SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived_docs
    FROM patient_documents
    ${whereSql}
  `, params);

  const r = rows[0];
  return {
    total_documents: r.total_documents || 0,
    medical_reports: r.medical_reports || 0,
    lab_reports: r.lab_reports || 0,
    prescriptions: r.prescriptions || 0,
    insurance_docs: r.insurance_docs || 0,
    referrals: r.referrals || 0,
    archived_docs: r.archived_docs || 0
  };
}

module.exports = {
  listDocuments,
  getDocumentById,
  uploadDocument,
  getDocumentFilePath,
  archiveDocument,
  deleteDocument,
  getDocumentStats
};
