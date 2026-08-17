const settingsService = require('../services/settings.service');
const { sendSuccess } = require('../utils/response');

async function getPublicSettings(req, res, next) {
  try {
    const result = await settingsService.getPublicSettings();
    return sendSuccess(res, result, 'Public hospital settings retrieved.');
  } catch (error) {
    next(error);
  }
}

async function getAllSettings(req, res, next) {
  try {
    const result = await settingsService.getAllSettings();
    return sendSuccess(res, result, 'Hospital settings retrieved.');
  } catch (error) {
    next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const result = await settingsService.updateSettings(req.body, req.user);
    return sendSuccess(res, result, 'Hospital settings updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function uploadBrandingAsset(req, res, next) {
  try {
    const { assetType, fileData, url } = req.body;
    const result = await settingsService.uploadBrandingAsset(assetType, fileData || { url }, req.user);
    return sendSuccess(res, result, result.message, 200);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPublicSettings,
  getAllSettings,
  updateSettings,
  uploadBrandingAsset
};
