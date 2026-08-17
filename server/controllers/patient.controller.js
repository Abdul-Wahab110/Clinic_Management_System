const patientService = require('../services/patient.service');
const { sendSuccess, sendPaginated } = require('../utils/response');

/**
 * List Patients with Search, Filtering, Sorting & Pagination
 */
async function listPatients(req, res, next) {
  try {
    const {
      search,
      status,
      gender,
      blood_group,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      page = 1,
      limit = 10
    } = req.query;

    const result = await patientService.listPatients({
      search,
      status,
      gender,
      blood_group,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      data: result.patients,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      },
      stats: result.stats,
      message: 'Patients retrieved successfully.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Comprehensive Patient Profile by ID
 */
async function getPatientById(req, res, next) {
  try {
    const patient = await patientService.getPatientById(req.params.id, req.user);
    return sendSuccess(res, patient, 'Patient profile retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Get Patient Appointments
 */
async function getPatientAppointments(req, res, next) {
  try {
    const appointments = await patientService.getPatientAppointments(req.params.id, req.user);
    return sendSuccess(res, appointments, 'Patient appointments retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Get Patient Visits / Encounters
 */
async function getPatientVisits(req, res, next) {
  try {
    const visits = await patientService.getPatientVisits(req.params.id, req.user);
    return sendSuccess(res, visits, 'Patient visits retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Get Patient Medical Records (EMR)
 */
async function getPatientMedicalRecords(req, res, next) {
  try {
    const records = await patientService.getPatientMedicalRecords(req.params.id, req.user);
    return sendSuccess(res, records, 'Patient medical records retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Get Patient Prescriptions
 */
async function getPatientPrescriptions(req, res, next) {
  try {
    const prescriptions = await patientService.getPatientPrescriptions(req.params.id, req.user);
    return sendSuccess(res, prescriptions, 'Patient prescriptions retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Get Patient Lab Reports
 */
async function getPatientLabReports(req, res, next) {
  try {
    const labReports = await patientService.getPatientLabReports(req.params.id, req.user);
    return sendSuccess(res, labReports, 'Patient laboratory reports retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Get Patient Invoices
 */
async function getPatientInvoices(req, res, next) {
  try {
    const invoices = await patientService.getPatientInvoices(req.params.id, req.user);
    return sendSuccess(res, invoices, 'Patient invoices retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Get Patient Payments
 */
async function getPatientPayments(req, res, next) {
  try {
    const payments = await patientService.getPatientPayments(req.params.id, req.user);
    return sendSuccess(res, payments, 'Patient payment receipts retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Get Patient Documents
 */
async function getPatientDocuments(req, res, next) {
  try {
    const documents = await patientService.getPatientDocuments(req.params.id, req.user);
    return sendSuccess(res, documents, 'Patient documents retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Get Patient Vitals Timeline
 */
async function getPatientVitals(req, res, next) {
  try {
    const vitals = await patientService.getPatientVitals(req.params.id, req.user);
    return sendSuccess(res, vitals, 'Patient vitals timeline retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Register / Create New Patient
 */
async function createPatient(req, res, next) {
  try {
    const patient = await patientService.createPatient(req.body, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, patient, 'Patient registered successfully.', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Update Existing Patient Record
 */
async function updatePatient(req, res, next) {
  try {
    const patient = await patientService.updatePatient(req.params.id, req.body, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, patient, 'Patient profile updated successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Activate / Deactivate Patient Status
 */
async function togglePatientStatus(req, res, next) {
  try {
    const { status } = req.body;
    const result = await patientService.togglePatientStatus(req.params.id, status, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete / Archive Patient
 */
async function deletePatient(req, res, next) {
  try {
    const result = await patientService.deletePatient(req.params.id, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

/**
 * Add Patient Document
 */
async function addPatientDocument(req, res, next) {
  try {
    const document = await patientService.addPatientDocument(req.params.id, req.body, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, document, 'Document uploaded/recorded successfully.', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete Patient Document
 */
async function deletePatientDocument(req, res, next) {
  try {
    const result = await patientService.deletePatientDocument(req.params.docId, req.params.id, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

/**
 * Add Medical Record (EMR)
 */
async function addMedicalRecord(req, res, next) {
  try {
    const record = await patientService.addMedicalRecord(req.params.id, req.body, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, record, 'Medical record added successfully.', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Add Prescription
 */
async function addPrescription(req, res, next) {
  try {
    const prescription = await patientService.addPrescription(req.params.id, req.body, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, prescription, 'Prescription added successfully.', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Add Patient Vitals
 */
async function addPatientVitals(req, res, next) {
  try {
    const vitals = await patientService.addPatientVitals(req.params.id, req.body, req.user, req.ip, req.get('user-agent'));
    return sendSuccess(res, vitals, 'Vitals recorded successfully.', 201);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listPatients,
  getPatientById,
  getPatientAppointments,
  getPatientVisits,
  getPatientMedicalRecords,
  getPatientPrescriptions,
  getPatientLabReports,
  getPatientInvoices,
  getPatientPayments,
  getPatientDocuments,
  getPatientVitals,
  createPatient,
  updatePatient,
  togglePatientStatus,
  deletePatient,
  addPatientDocument,
  deletePatientDocument,
  addMedicalRecord,
  addPrescription,
  addPatientVitals
};
