const db = require('../config/db');

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Convert HH:MM:SS or HH:MM to integer minutes from midnight
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Convert integer minutes from midnight to HH:MM (24-hr)
 */
function minutesToTime(totalMins) {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Convert HH:MM (24-hr) to human-readable 12-hr format (e.g. "09:30 AM")
 */
function formatTime12Hour(time24) {
  const parts = time24.split(':');
  let h = parseInt(parts[0], 10) || 0;
  const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

/**
 * Get weekday name from YYYY-MM-DD
 */
function getDayOfWeek(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return weekDays[d.getDay()];
}

/**
 * Calculate Real Doctor Availability & Generate Verified Booking Slots
 * Factors in:
 * 1. Doctor status & active credentials
 * 2. Weekly day schedule & working shift hours
 * 3. Break times (e.g., 13:00 - 14:00)
 * 4. Doctor leaves & blocked time slots
 * 5. Existing booked appointments in MySQL
 * 6. Past times if date is today
 */
async function calculateDoctorAvailability(doctorId, dateStr) {
  const targetDayOfWeek = getDayOfWeek(dateStr);

  // 1. Fetch Doctor and Department Details
  const [doctors] = await db.query(
    `SELECT 
        d.id,
        d.doctor_code,
        u.full_name as name,
        u.email,
        u.phone,
        d.specialization,
        d.qualification,
        d.consultation_fee,
        d.room_number,
        d.status,
        d.is_available,
        dept.id as department_id,
        dept.name as department_name,
        dept.code as department_code
     FROM doctors d
     JOIN users u ON d.user_id = u.id
     JOIN departments dept ON d.department_id = dept.id
     WHERE d.id = ? OR d.doctor_code = ? LIMIT 1`,
    [doctorId, doctorId]
  );

  if (doctors.length === 0) {
    const error = new Error('Doctor not found.');
    error.statusCode = 404;
    throw error;
  }
  const doctor = doctors[0];

  const responseBase = {
    doctor_id: doctor.id,
    doctor_code: doctor.doctor_code,
    doctor_name: doctor.name,
    specialization: doctor.specialization,
    department_id: doctor.department_id,
    department_name: doctor.department_name,
    room_number: doctor.room_number || 'Clinic Suite',
    consultation_fee: parseFloat(doctor.consultation_fee),
    date: dateStr,
    day_of_week: targetDayOfWeek,
    is_available: false,
    reason: null,
    working_shift: null,
    break_time: null,
    total_slots_generated: 0,
    available_slots_count: 0,
    booked_slots_count: 0,
    slots: [],
    available_slots: []
  };

  // Check doctor general status
  if (doctor.status !== 'active' || doctor.is_available === 0) {
    responseBase.reason = `Doctor is currently ${doctor.status.replace('_', ' ')} and unavailable for outpatient consultations.`;
    return responseBase;
  }

  // 2. Check Doctor Approved Leaves & Blocked Dates
  const [leaves] = await db.query(
    `SELECT id, leave_type, reason, is_full_day, start_time, end_time
     FROM doctor_leaves
     WHERE doctor_id = ? 
       AND status = 'approved'
       AND start_date <= ? 
       AND end_date >= ?`,
    [doctor.id, dateStr, dateStr]
  );

  const fullDayLeave = leaves.find(l => l.is_full_day === 1);
  if (fullDayLeave) {
    responseBase.reason = `Doctor is on approved leave (${fullDayLeave.leave_type.toUpperCase()}${fullDayLeave.reason ? ': ' + fullDayLeave.reason : ''}).`;
    return responseBase;
  }

  // 3. Fetch Doctor Schedule for the Day of Week
  const [schedules] = await db.query(
    `SELECT 
        id, 
        day_of_week, 
        start_time, 
        end_time, 
        break_start_time, 
        break_end_time, 
        slot_duration_minutes, 
        max_patients, 
        room_override,
        is_active
     FROM doctor_schedules
     WHERE doctor_id = ? AND day_of_week = ? AND is_active = 1 LIMIT 1`,
    [doctor.id, targetDayOfWeek]
  );

  if (schedules.length === 0) {
    responseBase.reason = `Doctor does not have a scheduled clinical shift on ${targetDayOfWeek}s.`;
    return responseBase;
  }

  const sched = schedules[0];
  const duration = sched.slot_duration_minutes || 20;
  const startMins = timeToMinutes(sched.start_time);
  const endMins = timeToMinutes(sched.end_time);
  const breakStartMins = sched.break_start_time ? timeToMinutes(sched.break_start_time) : null;
  const breakEndMins = sched.break_end_time ? timeToMinutes(sched.break_end_time) : null;

  responseBase.working_shift = {
    start_time: sched.start_time.substring(0, 5),
    end_time: sched.end_time.substring(0, 5),
    formatted: `${formatTime12Hour(sched.start_time.substring(0, 5))} - ${formatTime12Hour(sched.end_time.substring(0, 5))}`,
    slot_duration_minutes: duration,
    max_patients: sched.max_patients
  };

  if (breakStartMins && breakEndMins) {
    responseBase.break_time = {
      start_time: sched.break_start_time.substring(0, 5),
      end_time: sched.break_end_time.substring(0, 5),
      formatted: `${formatTime12Hour(sched.break_start_time.substring(0, 5))} - ${formatTime12Hour(sched.break_end_time.substring(0, 5))}`
    };
  }

  // 4. Fetch Existing Booked Appointments for this Date in MySQL
  const [existingAppts] = await db.query(
    `SELECT appointment_number, appointment_time, status
     FROM appointments
     WHERE doctor_id = ? 
       AND appointment_date = ? 
       AND status NOT IN ('cancelled', 'rejected')`,
    [doctor.id, dateStr]
  );

  const bookedTimes = new Set(
    existingAppts.map(a => a.appointment_time.substring(0, 5))
  );

  // 5. Determine Current Server Time (for "Today" filtering)
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const isToday = (dateStr === todayStr);
  const currentMins = now.getHours() * 60 + now.getMinutes();

  // 6. Generate Every Distinct Consultation Slot
  const allSlots = [];
  const availableSlotsList = [];

  for (let currentSlotMins = startMins; currentSlotMins + duration <= endMins; currentSlotMins += duration) {
    const slotStartTime = minutesToTime(currentSlotMins);
    const slotEndTime = minutesToTime(currentSlotMins + duration);
    const timeFormatted = formatTime12Hour(slotStartTime);

    // Check if slot falls in break interval
    let isBreak = false;
    if (breakStartMins !== null && breakEndMins !== null) {
      if (currentSlotMins >= breakStartMins && currentSlotMins < breakEndMins) {
        isBreak = true;
      }
    }

    // Check if slot falls in partial-day leave
    let isPartialLeave = false;
    let leaveReason = null;
    for (const l of leaves) {
      if (l.is_full_day === 0 && l.start_time && l.end_time) {
        const lStart = timeToMinutes(l.start_time);
        const lEnd = timeToMinutes(l.end_time);
        if (currentSlotMins >= lStart && currentSlotMins < lEnd) {
          isPartialLeave = true;
          leaveReason = l.reason || l.leave_type;
          break;
        }
      }
    }

    // Check if slot is already booked
    const isBooked = bookedTimes.has(slotStartTime);

    // Check if slot is in the past
    const isPast = isToday && currentSlotMins <= currentMins;

    let slotStatus = 'available';
    let isSlotAvailable = true;

    if (isBreak) {
      slotStatus = 'break';
      isSlotAvailable = false;
    } else if (isPartialLeave) {
      slotStatus = 'leave';
      isSlotAvailable = false;
    } else if (isBooked) {
      slotStatus = 'booked';
      isSlotAvailable = false;
    } else if (isPast) {
      slotStatus = 'past';
      isSlotAvailable = false;
    }

    const slotObj = {
      time: slotStartTime,
      end_time: slotEndTime,
      time_formatted: timeFormatted,
      status: slotStatus,
      is_available: isSlotAvailable,
      is_booked: isBooked,
      is_break: isBreak,
      is_leave: isPartialLeave,
      is_past: isPast,
      notes: isBreak ? 'Physician Clinical Break' : (isPartialLeave ? `Doctor Unavailable (${leaveReason})` : null)
    };

    allSlots.push(slotObj);

    if (isSlotAvailable) {
      availableSlotsList.push(slotStartTime);
    }
  }

  responseBase.is_available = availableSlotsList.length > 0;
  responseBase.total_slots_generated = allSlots.length;
  responseBase.available_slots_count = availableSlotsList.length;
  responseBase.booked_slots_count = existingAppts.length;
  responseBase.slots = allSlots;
  responseBase.available_slots = availableSlotsList;

  if (availableSlotsList.length === 0 && !responseBase.reason) {
    responseBase.reason = 'All consultation slots for this date are fully booked or have passed.';
  }

  return responseBase;
}

/**
 * Get Weekly Schedule for Doctor
 */
async function getDoctorSchedules(doctorId) {
  const [schedules] = await db.query(
    `SELECT 
        s.id, 
        s.doctor_id, 
        s.day_of_week, 
        s.start_time, 
        s.end_time, 
        s.break_start_time, 
        s.break_end_time, 
        s.slot_duration_minutes, 
        s.max_patients, 
        s.room_override,
        s.is_active
     FROM doctor_schedules s
     WHERE s.doctor_id = ?
     ORDER BY FIELD(s.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`,
    [doctorId]
  );
  return schedules;
}

/**
 * Batch Update / Upsert Doctor Weekly Schedules with Break Times & Quotas
 */
async function updateDoctorSchedules(doctorId, schedulesList, actorUser = null) {
  const [docRows] = await db.query('SELECT id, doctor_code FROM doctors WHERE id = ?', [doctorId]);
  if (docRows.length === 0) {
    const error = new Error('Doctor not found.');
    error.statusCode = 404;
    throw error;
  }

  for (const s of schedulesList) {
    await db.query(
      `INSERT INTO doctor_schedules 
       (doctor_id, day_of_week, start_time, end_time, break_start_time, break_end_time, slot_duration_minutes, max_patients, room_override, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       start_time = VALUES(start_time), 
       end_time = VALUES(end_time), 
       break_start_time = VALUES(break_start_time), 
       break_end_time = VALUES(break_end_time), 
       slot_duration_minutes = VALUES(slot_duration_minutes), 
       max_patients = VALUES(max_patients), 
       room_override = VALUES(room_override), 
       is_active = VALUES(is_active)`,
      [
        doctorId,
        s.day_of_week,
        s.start_time,
        s.end_time,
        s.break_start_time || '13:00:00',
        s.break_end_time || '14:00:00',
        s.slot_duration_minutes || 20,
        s.max_patients || 20,
        s.room_override || null,
        s.is_active !== undefined ? (s.is_active ? 1 : 0) : 1
      ]
    );
  }

  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'UPDATE_DOCTOR_SCHEDULES', 'SCHEDULE', ?, ?)`,
      [actorUser.id, doctorId, JSON.stringify({ doctorCode: docRows[0].doctor_code, updatedSlots: schedulesList.length })]
    ).catch(() => {});
  }

  return getDoctorSchedules(doctorId);
}

/**
 * Get Doctor Leaves & Blocked Dates
 */
async function getDoctorLeaves(filters = {}) {
  const { doctor_id, status, start_date, end_date } = filters;
  const conditions = [];
  const params = [];

  if (doctor_id) {
    conditions.push('l.doctor_id = ?');
    params.push(doctor_id);
  }

  if (status && status !== 'all') {
    conditions.push('l.status = ?');
    params.push(status);
  }

  if (start_date) {
    conditions.push('l.end_date >= ?');
    params.push(start_date);
  }

  if (end_date) {
    conditions.push('l.start_date <= ?');
    params.push(end_date);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [leaves] = await db.query(
    `SELECT 
        l.id,
        l.doctor_id,
        d.doctor_code,
        u.full_name as doctor_name,
        dept.name as department_name,
        l.start_date,
        l.end_date,
        l.leave_type,
        l.reason,
        l.is_full_day,
        l.start_time,
        l.end_time,
        l.status,
        l.created_at,
        u_appr.full_name as approved_by_name
     FROM doctor_leaves l
     JOIN doctors d ON l.doctor_id = d.id
     JOIN users u ON d.user_id = u.id
     JOIN departments dept ON d.department_id = dept.id
     LEFT JOIN users u_appr ON l.approved_by = u_appr.id
     ${whereClause}
     ORDER BY l.start_date DESC`,
    params
  );

  return leaves;
}

/**
 * Apply for Doctor Leave / Block Time
 */
async function applyDoctorLeave(leaveData, actorUser = null) {
  const {
    doctor_id,
    start_date,
    end_date,
    leave_type = 'annual',
    reason,
    is_full_day = true,
    start_time = null,
    end_time = null,
    status = 'approved'
  } = leaveData;

  const [docRows] = await db.query('SELECT id, doctor_code FROM doctors WHERE id = ?', [doctor_id]);
  if (docRows.length === 0) {
    const error = new Error('Doctor not found.');
    error.statusCode = 404;
    throw error;
  }

  // Check conflicting confirmed appointments
  const [conflictingAppts] = await db.query(
    `SELECT id, appointment_number, appointment_date, appointment_time
     FROM appointments 
     WHERE doctor_id = ? 
       AND appointment_date BETWEEN ? AND ?
       AND status IN ('confirmed', 'pending', 'checked_in')`,
    [doctor_id, start_date, end_date]
  );

  const [result] = await db.query(
    `INSERT INTO doctor_leaves 
     (doctor_id, start_date, end_date, leave_type, reason, is_full_day, start_time, end_time, status, approved_by) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      doctor_id,
      start_date,
      end_date,
      leave_type,
      reason || null,
      is_full_day ? 1 : 0,
      start_time || null,
      end_time || null,
      status,
      actorUser ? actorUser.id : null
    ]
  );

  const leaveId = result.insertId;

  if (actorUser) {
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES (?, 'CREATE_DOCTOR_LEAVE', 'LEAVE', ?, ?)`,
      [actorUser.id, leaveId, JSON.stringify({ doctorId: doctor_id, start_date, end_date, leave_type })]
    ).catch(() => {});
  }

  const leaves = await getDoctorLeaves({ doctor_id });
  return {
    leave: leaves.find(l => l.id === leaveId),
    conflicting_appointments_count: conflictingAppts.length,
    conflicting_appointments: conflictingAppts
  };
}

/**
 * Update Doctor Leave Status (Approve / Reject / Cancel)
 */
async function updateLeaveStatus(leaveId, status, actorUser = null) {
  const [existing] = await db.query('SELECT * FROM doctor_leaves WHERE id = ?', [leaveId]);
  if (existing.length === 0) {
    const error = new Error('Leave record not found.');
    error.statusCode = 404;
    throw error;
  }

  await db.query(
    'UPDATE doctor_leaves SET status = ?, approved_by = ? WHERE id = ?',
    [status, actorUser ? actorUser.id : null, leaveId]
  );

  return { id: leaveId, status };
}

/**
 * Master 7-Day Timetable Matrix Overview for All Doctors
 */
async function getAllSchedulesOverview() {
  const [doctors] = await db.query(
    `SELECT 
        d.id as doctor_id,
        d.doctor_code,
        u.full_name as doctor_name,
        d.specialization,
        d.room_number,
        dept.name as department_name,
        dept.code as department_code
     FROM doctors d
     JOIN users u ON d.user_id = u.id
     JOIN departments dept ON d.department_id = dept.id
     WHERE d.status != 'inactive'
     ORDER BY dept.name ASC, u.full_name ASC`
  );

  const overview = [];

  for (const doc of doctors) {
    const [schedules] = await db.query(
      `SELECT day_of_week, start_time, end_time, break_start_time, break_end_time, slot_duration_minutes, max_patients, is_active
       FROM doctor_schedules
       WHERE doctor_id = ?
       ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`,
      [doc.doctor_id]
    );

    const weekMap = {};
    weekDays.forEach(day => {
      const s = schedules.find(sched => sched.day_of_week === day && sched.is_active === 1);
      if (s) {
        weekMap[day] = {
          active: true,
          shift: `${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}`,
          break: s.break_start_time ? `${s.break_start_time.substring(0, 5)} - ${s.break_end_time.substring(0, 5)}` : '13:00 - 14:00',
          slot: s.slot_duration_minutes,
          max: s.max_patients
        };
      } else {
        weekMap[day] = { active: false, shift: 'OFF' };
      }
    });

    overview.push({
      ...doc,
      week_schedule: weekMap
    });
  }

  return overview;
}

module.exports = {
  calculateDoctorAvailability,
  getDoctorSchedules,
  updateDoctorSchedules,
  getDoctorLeaves,
  applyDoctorLeave,
  updateLeaveStatus,
  getAllSchedulesOverview
};
