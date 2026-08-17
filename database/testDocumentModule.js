const documentService = require('../server/services/document.service');
const db = require('../server/config/db');

async function runDocumentIntegrationTests() {
  console.log('🧪 Starting Secure Patient Document Management Module Integration Tests...\n');
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

  try {
    const adminUser = { id: 1, name: 'Dr. Administrator', role: 'super_admin' };
    const doctorUser = { id: 3, name: 'Dr. Marcus Vance', role: 'doctor' };
    const patientArthur = { id: 10, name: 'Arthur Pendleton', role: 'patient' };
    const patientEleanor = { id: 11, name: 'Eleanor Vance', role: 'patient' };

    // Test Suite 1: Document Upload & Validation
    console.log('--- Test Suite 1: Document Upload & Validation ---');
    const uploadResult = await documentService.uploadDocument({
      patient_id: 1,
      document_name: 'Post-Op Cardiac Echocardiogram Summary',
      category: 'Medical Report',
      notes: 'Transthoracic echocardiogram following catheterization.',
      mime_type: 'application/pdf',
      file_size_kb: 450
    }, '%PDF-1.4 Cardiac Echo Result Data', doctorUser);

    assert(uploadResult.id !== undefined, 'Document record created in MySQL');
    assert(uploadResult.patient_id === 1, 'Document linked to patient ID 1');
    assert(uploadResult.category === 'Medical Report', 'Category correctly assigned as Medical Report');
    assert(uploadResult.file_name.startsWith('doc_pat1_'), 'Safe randomized storage file name generated');

    // Test Suite 2: Document Metadata Inspection
    console.log('\n--- Test Suite 2: Document Metadata Inspection ---');
    const docMeta = await documentService.getDocumentById(uploadResult.id, doctorUser);
    assert(docMeta.id === uploadResult.id, 'Fetches document metadata by ID');
    assert(docMeta.patient_name && docMeta.patient_name.includes('Arthur'), 'Includes joined patient name');
    assert(docMeta.patient_code !== undefined, 'Includes patient code');
    assert(docMeta.uploader_name && docMeta.uploader_name.includes('Marcus Vance'), 'Includes uploader staff name');
    assert(docMeta.download_url !== undefined, 'Includes secure download endpoint URL');

    // Test Suite 3: Document Listing & Multi-Criteria Filtering
    console.log('\n--- Test Suite 3: Document Listing & Multi-Criteria Filtering ---');
    const allDocs = await documentService.listDocuments({ page: 1, limit: 10 }, adminUser);
    assert(allDocs.documents.length >= 3, 'Retrieves documents list for authorized staff');
    assert(allDocs.hasOwnProperty('pagination'), 'Includes pagination metadata');

    // Filter by Category "Medical Report"
    const medReports = await documentService.listDocuments({ category: 'Medical Report' }, adminUser);
    assert(medReports.documents.every(d => d.category === 'Medical Report'), 'All filtered documents have category "Medical Report"');

    // Filter by Patient ID 1
    const pat1Docs = await documentService.listDocuments({ patient_id: 1 }, adminUser);
    assert(pat1Docs.documents.every(d => d.patient_id === 1), 'All filtered documents belong to Patient ID 1');

    // Search by document name
    const searchDocs = await documentService.listDocuments({ search: 'Echocardiogram' }, adminUser);
    assert(searchDocs.documents.length >= 1, 'Search finds document by keyword');

    // Test Suite 4: Secure Download / Streaming Resolution
    console.log('\n--- Test Suite 4: Secure Download / Streaming Resolution ---');
    const fileStreamInfo = await documentService.getDocumentFilePath(uploadResult.id, doctorUser);
    assert(fileStreamInfo.absolutePath !== undefined, 'Resolves absolute physical file path');
    assert(fileStreamInfo.mimeType === 'application/pdf', 'Resolves MIME type');
    assert(fileStreamInfo.fileName.endsWith('.pdf'), 'Safe file name ends with .pdf');

    // Test Suite 5: CRITICAL SECURITY TEST - Patient Isolation & RBAC
    console.log('\n--- Test Suite 5: CRITICAL SECURITY TEST - Patient Isolation & RBAC ---');
    
    // Patient Arthur accessing his own document (Patient ID 1) -> ALLOWED
    const arthurOwnDoc = await documentService.getDocumentById(uploadResult.id, patientArthur);
    assert(arthurOwnDoc.id === uploadResult.id, 'Patient Arthur CAN access his own clinical document');

    // Patient Arthur listing documents -> only sees Patient 1 documents
    const arthurList = await documentService.listDocuments({}, patientArthur);
    assert(arthurList.documents.every(d => d.patient_id === 1), 'Patient Arthur only receives his own documents in document list');

    // Patient Eleanor (Patient ID 2) trying to access Patient Arthur's document -> FORBIDDEN (403)
    let eleanorForbidden = false;
    try {
      await documentService.getDocumentById(uploadResult.id, patientEleanor);
    } catch (err) {
      eleanorForbidden = err.statusCode === 403 || err.name === 'ForbiddenError';
    }
    assert(eleanorForbidden, 'SECURITY ENFORCED: Patient Eleanor is FORBIDDEN (403) from accessing Patient Arthur\'s document');

    // Patient Eleanor trying to download Patient Arthur's document -> FORBIDDEN (403)
    let eleanorDownloadBlocked = false;
    try {
      await documentService.getDocumentFilePath(uploadResult.id, patientEleanor);
    } catch (err) {
      eleanorDownloadBlocked = err.statusCode === 403 || err.name === 'ForbiddenError';
    }
    assert(eleanorDownloadBlocked, 'SECURITY ENFORCED: Patient Eleanor is FORBIDDEN (403) from downloading Patient Arthur\'s document');

    // Test Suite 6: Document Archive & Deletion Lifecycle
    console.log('\n--- Test Suite 6: Document Archive & Deletion Lifecycle ---');
    
    // Archive
    const archiveRes = await documentService.archiveDocument(uploadResult.id, adminUser);
    assert(archiveRes.status === 'archived', 'Document transitioned to archived status');

    const metaArchived = await documentService.getDocumentById(uploadResult.id, adminUser);
    assert(metaArchived.status === 'archived', 'Status persisted as "archived" in MySQL');

    // Delete
    const deleteRes = await documentService.deleteDocument(uploadResult.id, adminUser);
    assert(deleteRes.message.includes('removed'), 'Document successfully deleted');

    const [delCheck] = await db.query('SELECT id FROM patient_documents WHERE id = ?', [uploadResult.id]);
    assert(delCheck.length === 0, 'Document record permanently removed from MySQL');

    // Test Suite 7: Aggregated KPI Statistics
    console.log('\n--- Test Suite 7: Aggregated KPI Statistics ---');
    const docStats = await documentService.getDocumentStats(adminUser);
    assert(docStats.hasOwnProperty('total_documents'), 'Calculates total documents');
    assert(docStats.hasOwnProperty('medical_reports'), 'Calculates medical reports count');
    assert(docStats.hasOwnProperty('lab_reports'), 'Calculates lab reports count');
    assert(docStats.hasOwnProperty('insurance_docs'), 'Calculates insurance documents count');

    console.log('\n======================================================');
    console.log(`🏁 DOCUMENT MODULE INTEGRATION TEST RESULTS:`);
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

runDocumentIntegrationTests();
