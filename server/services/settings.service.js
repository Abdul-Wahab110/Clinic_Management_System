const db = require('../config/db');
const { NotFoundError, ValidationError } = require('../utils/errors');
const fs = require('fs');
const path = require('path');

/**
 * 1. Get Public Settings (Publicly Accessible)
 */
async function getPublicSettings() {
  const [rows] = await db.query(`
    SELECT 
      hospital_name,
      hospital_tagline,
      logo_url,
      favicon_url,
      footer_copyright,
      phone,
      email,
      address,
      emergency_number,
      opening_hours,
      currency_code,
      currency_symbol,
      timezone,
      allow_online_booking,
      appointment_duration_minutes
    FROM hospital_settings 
    WHERE id = 1 
    LIMIT 1
  `);

  if (rows.length === 0) {
    return {
      hospital_name: 'AuraCare Medical Center',
      hospital_tagline: 'Excellence in Comprehensive Healthcare & Specialized Medicine',
      logo_url: null,
      favicon_url: '/favicon.ico',
      footer_copyright: '© 2026 AuraCare Medical Center & Super Specialty Institute. All rights reserved.',
      phone: '+1 (800) 555-CARE',
      emergency_number: '+1 (800) 911-AURA',
      email: 'concierge@auracare.org',
      address: '742 Evergreen Healthcare Pavilion, Medical District, NY 10001',
      opening_hours: 'Mon - Sat: 08:00 AM - 08:00 PM | Emergency 24/7',
      currency_code: 'USD',
      currency_symbol: '$',
      timezone: 'America/New_York',
      allow_online_booking: 1,
      appointment_duration_minutes: 30
    };
  }

  return rows[0];
}

/**
 * 2. Get All Settings (Admin Only)
 */
async function getAllSettings() {
  const [rows] = await db.query(`
    SELECT 
      s.*,
      u.full_name as updated_by_name
    FROM hospital_settings s
    LEFT JOIN users u ON s.updated_by = u.id
    WHERE s.id = 1
    LIMIT 1
  `);

  if (rows.length === 0) {
    throw new NotFoundError('Hospital settings record not found.');
  }

  return rows[0];
}

/**
 * 3. Update Hospital Settings (Admin Only)
 */
async function updateSettings(data, user = null) {
  const current = await getAllSettings();

  const hospitalName = data.hospital_name ? data.hospital_name.trim() : current.hospital_name;
  const hospitalTagline = data.hospital_tagline !== undefined ? data.hospital_tagline.trim() : current.hospital_tagline;
  const logoUrl = data.logo_url !== undefined ? (data.logo_url ? data.logo_url.trim() : null) : current.logo_url;
  const faviconUrl = data.favicon_url !== undefined ? (data.favicon_url ? data.favicon_url.trim() : null) : current.favicon_url;
  const footerCopyright = data.footer_copyright !== undefined ? data.footer_copyright.trim() : (current.footer_copyright || '© 2026 ' + hospitalName + '. All rights reserved.');
  const phone = data.phone ? data.phone.trim() : current.phone;
  const email = data.email ? data.email.trim() : current.email;
  const address = data.address !== undefined ? data.address.trim() : current.address;
  const emergencyNumber = data.emergency_number ? data.emergency_number.trim() : current.emergency_number;
  const openingHours = data.opening_hours !== undefined ? data.opening_hours.trim() : current.opening_hours;
  const currencyCode = data.currency_code ? data.currency_code.trim() : current.currency_code;
  const currencySymbol = data.currency_symbol ? data.currency_symbol.trim() : current.currency_symbol;
  const timezone = data.timezone ? data.timezone.trim() : current.timezone;
  const invoicePrefix = data.invoice_prefix ? data.invoice_prefix.trim() : current.invoice_prefix;
  const patientPrefix = data.patient_prefix ? data.patient_prefix.trim() : current.patient_prefix;
  const appointmentDurationMinutes = data.appointment_duration_minutes !== undefined 
    ? parseInt(data.appointment_duration_minutes, 10) 
    : current.appointment_duration_minutes;
  const allowOnlineBooking = data.allow_online_booking !== undefined ? (data.allow_online_booking ? 1 : 0) : current.allow_online_booking;
  const maxAdvanceBookingDays = data.max_advance_booking_days !== undefined 
    ? parseInt(data.max_advance_booking_days, 10) 
    : current.max_advance_booking_days;
  const cancellationLeadHours = data.cancellation_lead_hours !== undefined 
    ? parseInt(data.cancellation_lead_hours, 10) 
    : current.cancellation_lead_hours;
  const emailNotificationsEnabled = data.email_notifications_enabled !== undefined ? (data.email_notifications_enabled ? 1 : 0) : current.email_notifications_enabled;
  const smsNotificationsEnabled = data.sms_notifications_enabled !== undefined ? (data.sms_notifications_enabled ? 1 : 0) : current.sms_notifications_enabled;
  const appointmentRemindersEnabled = data.appointment_reminders_enabled !== undefined ? (data.appointment_reminders_enabled ? 1 : 0) : current.appointment_reminders_enabled;
  const lowStockAlertsEnabled = data.low_stock_alerts_enabled !== undefined ? (data.low_stock_alerts_enabled ? 1 : 0) : current.low_stock_alerts_enabled;

  await db.query(`
    UPDATE hospital_settings SET
      hospital_name = ?,
      hospital_tagline = ?,
      logo_url = ?,
      favicon_url = ?,
      footer_copyright = ?,
      phone = ?,
      email = ?,
      address = ?,
      emergency_number = ?,
      opening_hours = ?,
      currency_code = ?,
      currency_symbol = ?,
      timezone = ?,
      invoice_prefix = ?,
      patient_prefix = ?,
      appointment_duration_minutes = ?,
      allow_online_booking = ?,
      max_advance_booking_days = ?,
      cancellation_lead_hours = ?,
      email_notifications_enabled = ?,
      sms_notifications_enabled = ?,
      appointment_reminders_enabled = ?,
      low_stock_alerts_enabled = ?,
      updated_by = ?,
      updated_at = NOW()
    WHERE id = 1
  `, [
    hospitalName,
    hospitalTagline,
    logoUrl,
    faviconUrl,
    footerCopyright,
    phone,
    email,
    address,
    emergencyNumber,
    openingHours,
    currencyCode,
    currencySymbol,
    timezone,
    invoicePrefix,
    patientPrefix,
    appointmentDurationMinutes,
    allowOnlineBooking,
    maxAdvanceBookingDays,
    cancellationLeadHours,
    emailNotificationsEnabled,
    smsNotificationsEnabled,
    appointmentRemindersEnabled,
    lowStockAlertsEnabled,
    user ? user.id : null
  ]);

  // Log in audit_logs
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, module, record_id, description, created_at)
       VALUES (?, ?, ?, 'UPDATE', 'SETTINGS', '1', ?, NOW())`,
      [
        user ? user.id : null,
        user ? (user.name || user.full_name) : 'Admin',
        user ? user.role : 'admin',
        `Updated hospital and system configuration for "${hospitalName}"`
      ]
    );
  } catch (_) {}

  return await getAllSettings();
}

/**
 * 4. Upload & Persist Branding Asset (Logo or Favicon)
 */
async function uploadBrandingAsset(assetType, fileData, user = null) {
  if (!['logo', 'favicon'].includes(assetType)) {
    throw new ValidationError('Invalid branding asset type. Allowed: logo, favicon');
  }

  const uploadsDir = path.join(__dirname, '../../public/uploads/branding');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  let finalRelativePath = '';

  if (typeof fileData === 'string' && fileData.startsWith('data:image/')) {
    // Base64 Data URL
    const matches = fileData.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) {
      throw new ValidationError('Invalid image data URL format.');
    }
    const ext = matches[1] === 'svg+xml' ? 'svg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${assetType}_${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);
    finalRelativePath = `/uploads/branding/${fileName}`;
  } else if (fileData && fileData.url) {
    finalRelativePath = fileData.url.trim();
  } else {
    throw new ValidationError('No valid image data or URL provided.');
  }

  // Persist URL into MySQL hospital_settings
  const fieldToUpdate = assetType === 'logo' ? 'logo_url' : 'favicon_url';
  await db.query(
    `UPDATE hospital_settings SET ${fieldToUpdate} = ?, updated_by = ?, updated_at = NOW() WHERE id = 1`,
    [finalRelativePath, user ? user.id : null]
  );

  return {
    asset_type: assetType,
    url: finalRelativePath,
    message: `${assetType === 'logo' ? 'Hospital Logo' : 'Favicon'} updated and persisted in MySQL.`
  };
}

module.exports = {
  getPublicSettings,
  getAllSettings,
  updateSettings,
  uploadBrandingAsset
};
