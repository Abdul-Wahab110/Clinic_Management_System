const documentService = require('../services/document.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listDocuments(req, res, next) {
  try {
    const result = await documentService.listDocuments(req.query, req.user);
    return sendSuccess(res, result.documents, 'Patient documents retrieved successfully.', result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getDocumentById(req, res, next) {
  try {
    const result = await documentService.getDocumentById(req.params.id, req.user);
    return sendSuccess(res, result, 'Document metadata retrieved.');
  } catch (error) {
    next(error);
  }
}

async function uploadDocument(req, res, next) {
  try {
    const fileData = req.body.file_data || (req.file ? req.file.buffer : null);
    const result = await documentService.uploadDocument(req.body, fileData, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function downloadDocument(req, res, next) {
  try {
    const fileInfo = await documentService.getDocumentFilePath(req.params.id, req.user);
    const safeDownloadName = fileInfo.doc.document_name.replace(/[^a-zA-Z0-9_\-\.]/g, '_') + '.pdf';
    
    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName}"`);
    return res.sendFile(fileInfo.absolutePath);
  } catch (error) {
    next(error);
  }
}

async function viewDocument(req, res, next) {
  try {
    const fileInfo = await documentService.getDocumentFilePath(req.params.id, req.user);
    res.setHeader('Content-Type', fileInfo.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    return res.sendFile(fileInfo.absolutePath);
  } catch (error) {
    next(error);
  }
}

async function archiveDocument(req, res, next) {
  try {
    const result = await documentService.archiveDocument(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function deleteDocument(req, res, next) {
  try {
    const result = await documentService.deleteDocument(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getDocumentStats(req, res, next) {
  try {
    const result = await documentService.getDocumentStats(req.user);
    return sendSuccess(res, result, 'Document statistics retrieved.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listDocuments,
  getDocumentById,
  uploadDocument,
  downloadDocument,
  viewDocument,
  archiveDocument,
  deleteDocument,
  getDocumentStats
};
