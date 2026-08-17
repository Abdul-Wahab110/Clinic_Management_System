const ipdService = require('../services/ipd.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listWards(req, res, next) {
  try {
    const wards = await ipdService.listWards(req.query);
    return sendSuccess(res, wards, 'Wards retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getWardById(req, res, next) {
  try {
    const ward = await ipdService.getWardById(req.params.id);
    return sendSuccess(res, ward, 'Ward details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createWard(req, res, next) {
  try {
    const result = await ipdService.createWard(req.body);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateWard(req, res, next) {
  try {
    const result = await ipdService.updateWard(req.params.id, req.body);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listRooms(req, res, next) {
  try {
    const rooms = await ipdService.listRooms(req.query);
    return sendSuccess(res, rooms, 'Rooms retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createRoom(req, res, next) {
  try {
    const result = await ipdService.createRoom(req.body);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateRoom(req, res, next) {
  try {
    const result = await ipdService.updateRoom(req.params.id, req.body);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listBeds(req, res, next) {
  try {
    const beds = await ipdService.listBeds(req.query);
    return sendSuccess(res, beds, 'Beds retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getBedVisualMatrix(req, res, next) {
  try {
    const matrix = await ipdService.getBedVisualMatrix();
    return sendSuccess(res, matrix, 'Bed visual matrix retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createBed(req, res, next) {
  try {
    const result = await ipdService.createBed(req.body);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateBedStatus(req, res, next) {
  try {
    const result = await ipdService.updateBedStatus(req.params.id, req.body);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listAdmissions(req, res, next) {
  try {
    const result = await ipdService.listAdmissions(req.query);
    return sendSuccess(res, result.admissions, 'Inpatient admissions retrieved successfully.', 200, result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getAdmissionById(req, res, next) {
  try {
    const admission = await ipdService.getAdmissionById(req.params.id);
    return sendSuccess(res, admission, 'Inpatient admission details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createAdmission(req, res, next) {
  try {
    const result = await ipdService.createAdmission(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function transferPatient(req, res, next) {
  try {
    const result = await ipdService.transferPatient(req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function dischargePatient(req, res, next) {
  try {
    const result = await ipdService.dischargePatient(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function addDailyRound(req, res, next) {
  try {
    const result = await ipdService.addDailyRound(req.params.id, req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listDailyRounds(req, res, next) {
  try {
    const rounds = await ipdService.listDailyRounds(req.params.id);
    return sendSuccess(res, rounds, 'Daily clinical rounds retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getIpdStats(req, res, next) {
  try {
    const stats = await ipdService.getIpdStats();
    return sendSuccess(res, stats, 'IPD statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listWards,
  getWardById,
  createWard,
  updateWard,
  listRooms,
  createRoom,
  updateRoom,
  listBeds,
  getBedVisualMatrix,
  createBed,
  updateBedStatus,
  listAdmissions,
  getAdmissionById,
  createAdmission,
  transferPatient,
  dischargePatient,
  addDailyRound,
  listDailyRounds,
  getIpdStats
};
