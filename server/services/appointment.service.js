const db = require('../config/db');
const logger = require('../utils/logger');
const scheduleService = require('./schedule.service');
const notificationService = require('./notification.service');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * List Appointments with Multi-Criteria Filtering, Search, and Pagination
 */
async function listAppointments(filters = {}, actorUser = null) {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    doctor_id,
    department_id,
    patient_id,
    date,
    start_date,
    end_date,
    date_preset,
    sortBy = 'appointment_date',
    sortOrder = 'DESC'
  } = filters;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const conditions = [];
  const params = [];

  // Role-based Access Scoping
  if (actorUser && actorUser.role === 'patient') {
    const [patRows] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [actorUser.id]);
    if (patRows.length > 0) {
      conditions.push('a.patient_id = ?');
      params.push(patRows[0].id);
    } else {
      conditions.push('1 = 0'); // No patient record associated
    }
  } else if (actorUser && actorUser.role === 'doctor') {
    const [docRows] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [actorUser.id]);
    if (docRows.length > 0) {
      conditions.push('a.doctor_id = ?');
      params.push(docRows[0].id);
    }
  } else if (actorUser && !['super_admin', 'hospital_admin'].includes(actorUser.role)) {
    // Non-admin staff (receptionist, nurse, lab, etc.) should not see pending requests of other doctors
    if (status === 'pending') {
      conditions.push('1 = 0');
    } else if (!status || status === 'all') {
      conditions.push("a.status != 'pending'");
    }
  }

  // Explicit Patient / Doctor / Department filters (Admin/Staff override)
  if (patient_id) {
    conditions.push('a.patient_id = ?');
    params.push(patient_id);
  }
  if (doctor_id) {
    conditions.push('a.doctor_id = ?');
    params.push(doctor_id);
  }
  if (department_id) {
    conditions.push('a.department_id = ?');
    params.push(department_id);
  }

  // Status Filter
  if (status && status !== 'all') {
    conditions.push('a.status = ?');
    params.push(status);
  }

  // Date Filtering
  const today = new Date().toISOString().split('T')[0];
  if (date) {
    conditions.push('a.appointment_date = ?');
    params.push(date);
  } else if (date_preset === 'today') {
    conditions.push('a.appointment_date = CURDATE()');
  } else if (date_preset === 'tomorrow') {
    conditions.push('a.appointment_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)');
  } else if (date_preset === 'this_week') {
    conditions.push('YEARWEEK(a.appointment_date, 1) = YEARWEEK(CURDATE(), 1)');
  } else if (date_preset === 'upcoming') {
    conditions.push('a.appointment_date >= CURDATE()');
  } else if (date_preset === 'past') {
    conditions.push('a.appointment_date < CURDATE()');
  } else {
    if (start_date) {
      conditions.push('a.appointment_date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('a.appointment_date <= ?');
      params.push(end_date);
    }
  }

  // Search Filter across appointment number, patient name, doctor name, patient phone, patient code
  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push(`(
      a.appointment_number LIKE ? OR
      p.first_name LIKE ? OR
      p.last_name LIKE ? OR
      CONCAT(p.first_name, ' ', p.last_name) LIKE ? OR
      p.patient_code LIKE ? OR
      p.phone LIKE ? OR
      u_doc.full_name LIKE ?
    )`);
    params.push(term, term, term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count Query
  const countSql = `
    SELECT COUNT(*) as total
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors doc ON a.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    JOIN departments dept ON a.department_id = dept.id
    ${whereClause}
  `;
  const [countResult] = await db.query(countSql, params);
  const total = countResult[0].total;

  // Sorting
  const allowedSortCols = {
    appointment_date: 'a.appointment_date',
    appointment_time: 'a.appointment_time',
    created_at: 'a.created_at',
    status: 'a.status',
    patient_name: 'p.first_name',
    doctor_name: 'u_doc.full_name'
  };
  const sortCol = allowedSortCols[sortBy] || 'a.appointment_date';
  const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Data Query
  const dataSql = `
    SELECT 
      a.id,
      a.appointment_number,
      a.patient_id,
      a.doctor_id,
      a.department_id,
      a.appointment_date,
      a.appointment_time,
      a.type,
      a.status,
      a.reason,
      a.notes,
      a.check_in_time,
      a.consultation_start_time,
      a.consultation_end_time,
      a.cancellation_reason,
      a.cancelled_at,
      a.rescheduled_at,
      a.created_at,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      CONCAT(p.first_name, ' ', p.last_name) as patient_name,
      p.gender as patient_gender,
      p.phone as patient_phone,
      p.email as patient_email,
      p.blood_group as patient_blood_group,
      doc.doctor_code,
      u_doc.full_name as doctor_name,
      doc.specialization as doctor_specialization,
      doc.room_number as doctor_room,
      doc.consultation_fee,
      dept.name as department_name,
      dept.code as department_code,
      dept.icon as department_icon
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors doc ON a.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    JOIN departments dept ON a.department_id = dept.id
    ${whereClause}
    ORDER BY ${sortCol} ${sortDir}, a.appointment_time ${sortDir}
    LIMIT ? OFFSET ?
  `;

  const [appointments] = await db.query(dataSql, [...params, parseInt(limit, 10), offset]);

  return {
    appointments,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10))
    }
  };
}

/**
 * Get Aggregated Appointment KPIs
 */
async function getAppointmentStats(actorUser = null) {
  let userCondition = '';
  const params = [];

  if (actorUser && actorUser.role === 'patient') {
    const [pat] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [actorUser.id]);
    if (pat.length > 0) {
      userCondition = 'WHERE patient_id = ?';
      params.push(pat[0].id);
    } else {
      userCondition = 'WHERE 1 = 0';
    }
  } else if (actorUser && actorUser.role === 'doctor') {
    const [doc] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [actorUser.id]);
    if (doc.length > 0) {
      userCondition = 'WHERE doctor_id = ?';
      params.push(doc[0].id);
    }
  }

  const sql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'checked_in' THEN 1 ELSE 0 END) as checked_in,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_show,
      SUM(CASE WHEN appointment_date = CURDATE() THEN 1 ELSE 0 END) as today_total,
      SUM(CASE WHEN appointment_date = CURDATE() AND status IN ('confirmed', 'checked_in', 'in_progress') THEN 1 ELSE 0 END) as today_queue
    FROM appointments
    ${userCondition}
  `;

  const [stats] = await db.query(sql, params);
  return {
    total: parseInt(stats[0].total, 10) || 0,
    pending: parseInt(stats[0].pending, 10) || 0,
    confirmed: parseInt(stats[0].confirmed, 10) || 0,
    checked_in: parseInt(stats[0].checked_in, 10) || 0,
    in_progress: parseInt(stats[0].in_progress, 10) || 0,
    completed: parseInt(stats[0].completed, 10) || 0,
    cancelled: parseInt(stats[0].cancelled, 10) || 0,
    no_show: parseInt(stats[0].no_show, 10) || 0,
    today_total: parseInt(stats[0].today_total, 10) || 0,
    today_queue: parseInt(stats[0].today_queue, 10) || 0
  };
}

/**
 * Get Comprehensive Appointment File by ID
 */
async function getAppointmentById(id, actorUser = null) {
  const [appts] = await db.query(
    `SELECT 
      a.*,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      CONCAT(p.first_name, ' ', p.last_name) as patient_name,
      p.gender as patient_gender,
      p.date_of_birth as patient_dob,
      p.phone as patient_phone,
      p.email as patient_email,
      p.blood_group as patient_blood_group,
      p.allergies as patient_allergies,
      p.emergency_contact_name,
      p.emergency_contact_phone,
      doc.doctor_code,
      u_doc.full_name as doctor_name,
      doc.specialization as doctor_specialization,
      doc.qualification as doctor_qualification,
      doc.room_number as doctor_room,
      doc.consultation_fee,
      dept.name as department_name,
      dept.code as department_code,
      dept.icon as department_icon,
      dept.floor_location as department_floor
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN doctors doc ON a.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    JOIN departments dept ON a.department_id = dept.id
    WHERE a.id = ? OR a.appointment_number = ? LIMIT 1`,
    [id, id]
  );

  if (appts.length === 0) {
    throw new NotFoundError('Appointment not found.');
  }

  const appt = appts[0];

  // Data isolation check for patients
  if (actorUser && actorUser.role === 'patient') {
    const [pat] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [actorUser.id]);
    if (pat.length === 0 || pat[0].id !== appt.patient_id) {
      throw new ForbiddenError('You are not authorized to view this appointment.');
    }
  }

  return appt;
}

/**
 * Book Appointment (Public or Authenticated Staff)
 * Prevents Double Bookings and verifies slot availability
 */
async function bookAppointment(data, actorUser = null, ip = null, userAgent = null) {
  return await db.withTransaction(async (conn) => {
    // 1. Verify Department
    const [depts] = await conn.query('SELECT id, name FROM departments WHERE id = ? AND is_active = 1', [data.department_id]);
    if (depts.length === 0) {
      throw new NotFoundError('Selected medical department is invalid or inactive.');
    }

    // 2. Doctor selection
    let doctorId = data.doctor_id || null;
    if (!doctorId) {
      const [docs] = await conn.query('SELECT id FROM doctors WHERE department_id = ? AND is_available = 1 LIMIT 1', [data.department_id]);
      if (docs.length > 0) {
        doctorId = docs[0].id;
      } else {
        const [anyDoc] = await conn.query('SELECT id FROM doctors WHERE is_available = 1 LIMIT 1');
        if (anyDoc.length > 0) doctorId = anyDoc[0].id;
        else throw new BadRequestError('No active doctors available in this department.');
      }
    }

    // 3. Resolve or create patient
    let patientId = data.patient_id || null;
    if (!patientId) {
      if (actorUser && actorUser.role === 'patient') {
        const [p] = await conn.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [actorUser.id]);
        if (p.length > 0) patientId = p[0].id;
      }
    }

    if (!patientId) {
      const phone = (data.phone || '').trim();
      const email = (data.email || '').trim();
      const [existingPatients] = await conn.query(
        'SELECT id FROM patients WHERE phone = ? OR (email IS NOT NULL AND email != "" AND email = ?) LIMIT 1',
        [phone, email]
      );

      if (existingPatients.length > 0) {
        patientId = existingPatients[0].id;
      } else {
        const patientCode = `PAT-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        const [newPat] = await conn.query(
          `INSERT INTO patients (patient_code, first_name, last_name, gender, date_of_birth, phone, email, address)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            patientCode,
            data.first_name.trim(),
            data.last_name.trim(),
            data.gender || 'other',
            data.date_of_birth || '1995-01-01',
            phone,
            email || null,
            data.address || null
          ]
        );
        patientId = newPat.insertId;
      }
    }

    // 4. Time format & double booking collision prevention
    let apptTime = data.appointment_time || '09:30:00';
    if (apptTime.length === 5) apptTime += ':00';

    const [conflicts] = await conn.query(
      `SELECT id FROM appointments 
       WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? 
         AND status NOT IN ('cancelled', 'rejected') LIMIT 1`,
      [doctorId, data.appointment_date, apptTime]
    );

    if (conflicts.length > 0) {
      throw new BadRequestError(`The selected time slot (${apptTime.substring(0, 5)}) has already been booked. Please pick another available time.`);
    }

    // 5. Generate unique appointment number
    const apptNumber = `APT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const initialStatus = (actorUser && ['super_admin', 'hospital_admin', 'doctor', 'receptionist'].includes(actorUser.role))
      ? 'confirmed'
      : 'pending';

    const [apptResult] = await conn.query(
      `INSERT INTO appointments 
       (appointment_number, patient_id, doctor_id, department_id, appointment_date, appointment_time, type, status, reason, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        apptNumber,
        patientId,
        doctorId,
        data.department_id,
        data.appointment_date,
        apptTime,
        data.type || 'consultation',
        initialStatus,
        data.reason.trim(),
        data.notes || null
      ]
    );

    const newApptId = apptResult.insertId;

    // 6. Audit log
    await conn.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'BOOK_APPOINTMENT', 'APPOINTMENT', ?, ?)`,
      [
        actorUser ? actorUser.id : null,
        newApptId,
        JSON.stringify({ appointmentNumber: apptNumber, doctorId, date: data.appointment_date, time: apptTime })
      ]
    ).catch(() => {});

    // Dispatch notifications asynchronously
    setImmediate(() => {
      notifyAppointmentParties(newApptId, 'CREATED');
    });

    return {
      id: newApptId,
      appointmentId: newApptId,
      appointmentNumber: apptNumber,
      status: initialStatus,
      appointmentDate: data.appointment_date,
      appointmentTime: apptTime.substring(0, 5),
      message: 'Appointment successfully booked into clinical roster.'
    };
  });
}

/**
 * Notify relevant parties upon appointment lifecycle events
 */
async function notifyAppointmentParties(appointmentId, eventType, details = {}) {
  try {
    const [rows] = await db.query(
      `SELECT a.*, p.user_id as patient_user_id, p.first_name, p.last_name, 
              d.user_id as doctor_user_id, u_doc.full_name as doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       JOIN users u_doc ON d.user_id = u_doc.id
       WHERE a.id = ?`,
      [appointmentId]
    );
    if (rows.length === 0) return;
    const appt = rows[0];

    // Find all Super Admins & Hospital Admins
    const [admins] = await db.query(
      `SELECT u.id FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE r.name IN ('super_admin', 'hospital_admin') AND u.status = 'active'`
    );

    if (eventType === 'CREATED') {
      // Notify Admins
      for (const adm of admins) {
        await notificationService.createNotification({
          user_id: adm.id,
          title: 'New Appointment Request',
          message: `Patient ${appt.first_name} ${appt.last_name} requested an appointment with Dr. ${appt.doctor_name} for ${appt.appointment_date} at ${appt.appointment_time ? appt.appointment_time.substring(0, 5) : 'Scheduled'}.`,
          type: 'appointment',
          notification_type: 'system_notification',
          priority: 'high',
          action_url: `/admin/appointments`,
          reference_id: appt.id,
          reference_type: 'appointment'
        }).catch(() => {});
      }
      // Notify Assigned Doctor
      if (appt.doctor_user_id) {
        await notificationService.createNotification({
          user_id: appt.doctor_user_id,
          title: 'New Appointment Request Assigned',
          message: `Patient ${appt.first_name} ${appt.last_name} requested a consultation on ${appt.appointment_date} at ${appt.appointment_time ? appt.appointment_time.substring(0, 5) : 'Scheduled'}.`,
          type: 'appointment',
          notification_type: 'system_notification',
          priority: 'high',
          action_url: `/doctor/appointments`,
          reference_id: appt.id,
          reference_type: 'appointment'
        }).catch(() => {});
      }
    } else if (eventType === 'ACCEPTED') {
      // Notify Patient
      if (appt.patient_user_id) {
        await notificationService.createNotification({
          user_id: appt.patient_user_id,
          title: 'Appointment Request Accepted',
          message: `Your appointment (#${appt.appointment_number}) with Dr. ${appt.doctor_name} on ${appt.appointment_date} at ${appt.appointment_time ? appt.appointment_time.substring(0, 5) : 'Scheduled'} has been confirmed.`,
          type: 'success',
          notification_type: 'appointment_confirmation',
          priority: 'high',
          action_url: `/patient/appointments`,
          reference_id: appt.id,
          reference_type: 'appointment'
        }).catch(() => {});
      }
      // Notify Doctor
      if (appt.doctor_user_id) {
        await notificationService.createNotification({
          user_id: appt.doctor_user_id,
          title: 'Appointment Accepted & Scheduled',
          message: `Appointment #${appt.appointment_number} with ${appt.first_name} ${appt.last_name} is confirmed for ${appt.appointment_date} at ${appt.appointment_time ? appt.appointment_time.substring(0, 5) : 'Scheduled'}.`,
          type: 'appointment',
          notification_type: 'appointment_confirmation',
          priority: 'normal',
          action_url: `/doctor/appointments`,
          reference_id: appt.id,
          reference_type: 'appointment'
        }).catch(() => {});
      }
    } else if (eventType === 'REJECTED') {
      // Notify Patient
      if (appt.patient_user_id) {
        const reasonText = details.reason ? ` Reason: ${details.reason}` : '';
        await notificationService.createNotification({
          user_id: appt.patient_user_id,
          title: 'Appointment Request Declined',
          message: `Your appointment request (#${appt.appointment_number}) for ${appt.appointment_date} could not be scheduled.${reasonText}`,
          type: 'danger',
          notification_type: 'appointment_cancellation',
          priority: 'high',
          action_url: `/patient/appointments`,
          reference_id: appt.id,
          reference_type: 'appointment'
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Error dispatching appointment notifications:', err);
  }
}

/**
 * Approve Appointment Request (Accept)
 */
async function approveAppointment(id, actorUser = null) {
  return await db.withTransaction(async (conn) => {
    const [existing] = await conn.query('SELECT * FROM appointments WHERE id = ?', [id]);
    if (existing.length === 0) throw new NotFoundError('Appointment not found.');
    const appt = existing[0];

    // Check authorization: Super Admin, Hospital Admin, or assigned Doctor
    if (actorUser && actorUser.role === 'doctor') {
      const [doc] = await conn.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [actorUser.id]);
      if (doc.length === 0 || doc[0].id !== appt.doctor_id) {
        throw new ForbiddenError('You can only approve appointments assigned to you.');
      }
    }

    if (['completed', 'cancelled', 'rejected'].includes(appt.status)) {
      throw new BadRequestError(`Cannot approve an appointment that is already ${appt.status}.`);
    }

    await conn.query(
      `UPDATE appointments SET status = 'confirmed', updated_at = NOW() WHERE id = ?`,
      [id]
    );

    await logger.audit(actorUser?.id || null, 'APPROVE_APPOINTMENT', 'appointments', id, null, null, {
      appointmentNumber: appt.appointment_number,
      previousStatus: appt.status,
      newStatus: 'confirmed'
    }, conn);

    // Trigger notifications
    setImmediate(() => {
      notifyAppointmentParties(id, 'ACCEPTED');
    });

    return {
      id,
      appointment_number: appt.appointment_number,
      status: 'confirmed',
      message: 'Appointment request approved and confirmed globally.'
    };
  });
}

/**
 * Reject Appointment Request
 */
async function rejectAppointment(id, reason, actorUser = null) {
  return await db.withTransaction(async (conn) => {
    const [existing] = await conn.query('SELECT * FROM appointments WHERE id = ?', [id]);
    if (existing.length === 0) throw new NotFoundError('Appointment not found.');
    const appt = existing[0];

    // Check authorization
    if (actorUser && actorUser.role === 'doctor') {
      const [doc] = await conn.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [actorUser.id]);
      if (doc.length === 0 || doc[0].id !== appt.doctor_id) {
        throw new ForbiddenError('You can only reject appointments assigned to you.');
      }
    }

    if (['completed', 'cancelled'].includes(appt.status)) {
      throw new BadRequestError(`Cannot reject an appointment that is already ${appt.status}.`);
    }

    await conn.query(
      `UPDATE appointments 
       SET status = 'rejected', 
           rejected_by = ?, 
           rejected_at = NOW(), 
           rejection_reason = ?,
           updated_at = NOW() 
       WHERE id = ?`,
      [actorUser?.id || null, reason || 'Declined by clinic / physician', id]
    );

    await logger.audit(actorUser?.id || null, 'REJECT_APPOINTMENT', 'appointments', id, null, null, {
      appointmentNumber: appt.appointment_number,
      previousStatus: appt.status,
      newStatus: 'rejected',
      reason
    }, conn);

    // Trigger notifications
    setImmediate(() => {
      notifyAppointmentParties(id, 'REJECTED', { reason });
    });

    return {
      id,
      appointment_number: appt.appointment_number,
      status: 'rejected',
      message: 'Appointment request rejected.'
    };
  });
}

/**
 * Calculate Available Time Slots for Doctor on Specific Date
 */
async function getAvailableSlots(doctorId, date) {
  if (!doctorId || !date) {
    throw new BadRequestError('Doctor ID and Date (YYYY-MM-DD) are required.');
  }

  const dateObj = new Date(date + 'T00:00:00');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[dateObj.getDay()];

  // Query doctor schedule
  const [schedules] = await db.query(
    `SELECT start_time, end_time, slot_duration_minutes, max_patients 
     FROM doctor_schedules 
     WHERE doctor_id = ? AND day_of_week = ? AND is_active = 1 LIMIT 1`,
    [doctorId, dayOfWeek]
  );

  let startTime = '09:00:00';
  let endTime = '17:00:00';
  let duration = 30;

  if (schedules.length > 0) {
    startTime = schedules[0].start_time;
    endTime = schedules[0].end_time;
    duration = schedules[0].slot_duration_minutes || 30;
  }

  // Generate slots
  const slots = [];
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes + duration <= endMinutes) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    slots.push(timeStr);
    currentMinutes += duration;
  }

  // Query existing booked appointments
  const [booked] = await db.query(
    `SELECT appointment_time FROM appointments 
     WHERE doctor_id = ? AND appointment_date = ? 
       AND status NOT IN ('cancelled', 'rejected')`,
    [doctorId, date]
  );

  const bookedSet = new Set(booked.map(b => b.appointment_time.substring(0, 5)));

  const slotResults = slots.map(time => ({
    time,
    available: !bookedSet.has(time)
  }));

  return {
    doctor_id: parseInt(doctorId, 10),
    date,
    day_of_week: dayOfWeek,
    slots: slotResults,
    total_slots: slotResults.length,
    available_slots: slotResults.filter(s => s.available).length
  };
}

/**
 * Reschedule Appointment to New Date & Time Slot
 */
async function rescheduleAppointment(id, rescheduleData, actorUser = null) {
  const { appointment_date, appointment_time, doctor_id, reason } = rescheduleData;
  let newTime = appointment_time;
  if (newTime.length === 5) newTime += ':00';

  return await db.withTransaction(async (conn) => {
    // 1. Fetch existing appointment
    const [existing] = await conn.query('SELECT * FROM appointments WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new NotFoundError('Appointment not found.');
    }
    const currentAppt = existing[0];

    if (['completed', 'cancelled'].includes(currentAppt.status)) {
      throw new BadRequestError(`Cannot reschedule an appointment with status '${currentAppt.status}'.`);
    }

    const targetDoctorId = doctor_id ? parseInt(doctor_id, 10) : currentAppt.doctor_id;

    // 2. Prevent collision on new slot
    const [conflicts] = await conn.query(
      `SELECT id FROM appointments 
       WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? 
         AND id != ?
         AND status NOT IN ('cancelled', 'rejected') LIMIT 1`,
      [targetDoctorId, appointment_date, newTime, id]
    );

    if (conflicts.length > 0) {
      throw new BadRequestError(`The requested reschedule slot (${newTime.substring(0, 5)}) is already reserved.`);
    }

    // 3. Update appointment
    await conn.query(
      `UPDATE appointments 
       SET appointment_date = ?, 
           appointment_time = ?, 
           doctor_id = ?, 
           status = 'confirmed',
           rescheduled_at = NOW(),
           notes = CONCAT(IFNULL(notes, ''), '\n[Rescheduled: ', NOW(), ' - Reason: ', ?, ']')
       WHERE id = ?`,
      [appointment_date, newTime, targetDoctorId, reason || 'Patient/Clinic Request', id]
    );

    // 4. Audit log
    await conn.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'RESCHEDULE_APPOINTMENT', 'APPOINTMENT', ?, ?)`,
      [
        actorUser ? actorUser.id : null,
        id,
        JSON.stringify({ from: `${currentAppt.appointment_date} ${currentAppt.appointment_time}`, to: `${appointment_date} ${newTime}` })
      ]
    ).catch(() => {});

    return {
      id,
      appointment_number: currentAppt.appointment_number,
      appointment_date,
      appointment_time: newTime.substring(0, 5),
      status: 'confirmed',
      message: 'Appointment successfully rescheduled.'
    };
  });
}

/**
 * Update Appointment Status Transition
 * Handles: confirm, check_in, in_progress, complete, cancel, no_show
 */
async function updateAppointmentStatus(id, statusData, actorUser = null) {
  const { status, cancellation_reason, notes } = statusData;

  return await db.withTransaction(async (conn) => {
    const [existing] = await conn.query('SELECT * FROM appointments WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new NotFoundError('Appointment not found.');
    }
    const current = existing[0];

    const updates = ['status = ?'];
    const params = [status];

    if (status === 'checked_in' && !current.check_in_time) {
      updates.push('check_in_time = NOW()');
    } else if (status === 'in_progress' && !current.consultation_start_time) {
      updates.push('consultation_start_time = NOW()');
    } else if (status === 'completed' && !current.consultation_end_time) {
      updates.push('consultation_end_time = NOW()');
    } else if (status === 'cancelled') {
      updates.push('cancelled_at = NOW()');
      if (cancellation_reason) {
        updates.push('cancellation_reason = ?');
        params.push(cancellation_reason);
      }
      if (actorUser) {
        updates.push('cancelled_by = ?');
        params.push(actorUser.id);
      }
    }

    if (notes) {
      updates.push('notes = CONCAT(IFNULL(notes, ""), "\n", ?)');
      params.push(notes);
    }

    params.push(id);
    await conn.query(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`, params);

    // Audit log
    await conn.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'UPDATE_APPOINTMENT_STATUS', 'APPOINTMENT', ?, ?)`,
      [actorUser ? actorUser.id : null, id, JSON.stringify({ from: current.status, to: status })]
    ).catch(() => {});

    return {
      id,
      appointment_number: current.appointment_number,
      status,
      message: `Appointment status updated to ${status}.`
    };
  });
}

/**
 * Delete / Cancel Appointment
 */
async function deleteAppointment(id, actorUser = null) {
  const [existing] = await db.query('SELECT * FROM appointments WHERE id = ?', [id]);
  if (existing.length === 0) {
    throw new NotFoundError('Appointment not found.');
  }

  await db.query('DELETE FROM appointments WHERE id = ?', [id]);

  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'DELETE_APPOINTMENT', 'APPOINTMENT', ?, ?)`,
      [actorUser.id, id, JSON.stringify({ appointmentNumber: existing[0].appointment_number })]
    ).catch(() => {});
  }

  return { id, message: 'Appointment record deleted successfully.' };
}

module.exports = {
  listAppointments,
  getAppointmentStats,
  getAppointmentById,
  bookAppointment,
  bookPublicAppointment: bookAppointment, // alias for public booking
  rescheduleAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  approveAppointment,
  rejectAppointment,
  getAvailableSlots,
  notifyAppointmentParties
};
