const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateId, getLagosToday, formatPhone } = require('../utils/helpers');
const smsService = require('../services/sms.service');
const { AppError } = require('../middleware/errorHandler');

/**
 * Get appointment report (appointments per clinic, daily/weekly/monthly).
 * GET /api/admin/reports/appointments?period=daily&date=2024-01-15
 */
const getAppointmentReport = async (req, res, next) => {
  try {
    const { period = 'daily', date } = req.query;
    const targetDate = date || getLagosToday();

    let dateFilter;
    if (period === 'daily') {
      dateFilter = { 'schedule_slots.slot_date': targetDate };
    } else if (period === 'weekly') {
      const start = new Date(targetDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      dateFilter = (q) =>
        q.whereBetween('schedule_slots.slot_date', [
          start.toISOString().split('T')[0],
          end.toISOString().split('T')[0],
        ]);
    } else {
      const [year, month] = targetDate.split('-');
      dateFilter = (q) =>
        q.whereRaw("CAST(schedule_slots.slot_date AS TEXT) LIKE ?", [`${year}-${month}%`]);
    }

    let query = db('appointments')
      .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
      .join('clinics', 'appointments.clinic_id', 'clinics.id')
      .select(
        'clinics.name as clinic_name',
        db.raw('COUNT(appointments.id) as total_appointments'),
        db.raw("COUNT(CASE WHEN appointments.status = 'completed' THEN 1 END) as completed"),
        db.raw("COUNT(CASE WHEN appointments.status = 'no_show' THEN 1 END) as no_shows"),
        db.raw("COUNT(CASE WHEN appointments.status = 'cancelled' THEN 1 END) as cancelled"),
        db.raw("COUNT(CASE WHEN appointments.status = 'booked' THEN 1 END) as upcoming")
      )
      .groupBy('clinics.name');

    if (typeof dateFilter === 'function') {
      query = dateFilter(query);
    } else {
      query = query.where(dateFilter);
    }

    const report = await query;

    res.json({ success: true, data: { period, date: targetDate, clinics: report } });
  } catch (error) {
    next(error);
  }
};

/**
 * Get no-show report.
 * GET /api/admin/reports/no-shows?from=2024-01-01&to=2024-01-31
 */
const getNoShowReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    let query = db('appointments')
      .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
      .join('clinics', 'appointments.clinic_id', 'clinics.id')
      .select(
        'clinics.name as clinic_name',
        db.raw('COUNT(appointments.id) as total_appointments'),
        db.raw("COUNT(CASE WHEN appointments.status = 'no_show' THEN 1 END) as no_shows"),
        db.raw("ROUND(100.0 * COUNT(CASE WHEN appointments.status = 'no_show' THEN 1 END) / NULLIF(COUNT(appointments.id), 0), 1) as no_show_rate")
      )
      .groupBy('clinics.name');

    if (from && to) {
      query = query.whereBetween('schedule_slots.slot_date', [from, to]);
    }

    const report = await query;
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

/**
 * Get daily clinic load.
 * GET /api/admin/reports/clinic-load?date=2024-01-15
 */
const getClinicLoad = async (req, res, next) => {
  try {
    const date = req.query.date || getLagosToday();

    const load = await db('schedule_slots')
      .join('clinics', 'schedule_slots.clinic_id', 'clinics.id')
      .leftJoin('appointments', function () {
        this.on('schedule_slots.id', 'appointments.slot_id')
          .andOnIn('appointments.status', ['booked', 'checked_in', 'in_consultation', 'completed']);
      })
      .where('schedule_slots.slot_date', date)
      .where('schedule_slots.is_blocked', false)
      .select(
        'clinics.name as clinic_name',
        db.raw('COUNT(schedule_slots.id) as total_slots'),
        db.raw('COUNT(appointments.id) as booked_slots'),
        db.raw('COUNT(schedule_slots.id) - COUNT(appointments.id) as available_slots'),
        db.raw('ROUND(100.0 * COUNT(appointments.id) / NULLIF(COUNT(schedule_slots.id), 0), 1) as occupancy_pct')
      )
      .groupBy('clinics.name');

    res.json({ success: true, data: { date, clinics: load } });
  } catch (error) {
    next(error);
  }
};

/**
 * Block a date for a clinic.
 * POST /api/admin/block-date
 */
const blockDate = async (req, res, next) => {
  try {
    const { clinic_id, date, reason } = req.body;

    // Block all slots on that date
    const updated = await db('schedule_slots')
      .where({ clinic_id, slot_date: date })
      .update({ is_blocked: true });

    // Log
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'BLOCK_DATE',
      details: JSON.stringify({ clinic_id, date, reason, slotsBlocked: updated }),
      created_at: new Date(),
    });

    res.json({ success: true, message: `${updated} slots blocked on ${date}.` });
  } catch (error) {
    next(error);
  }
};

/**
 * Unblock a date.
 * DELETE /api/admin/block-date/:clinicId/:date
 */
const unblockDate = async (req, res, next) => {
  try {
    const { clinicId, date } = req.params;

    const updated = await db('schedule_slots')
      .where({ clinic_id: clinicId, slot_date: date })
      .update({ is_blocked: false });

    res.json({ success: true, message: `${updated} slots unblocked.` });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a clinic session and send bulk SMS.
 * POST /api/admin/cancel-session
 */
const cancelSession = async (req, res, next) => {
  try {
    const { clinic_id, date, reason } = req.body;

    // Get all booked appointments for that date
    const appointments = await db('appointments')
      .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
      .join('mothers', 'appointments.mother_id', 'mothers.id')
      .join('clinics', 'appointments.clinic_id', 'clinics.id')
      .where('appointments.clinic_id', clinic_id)
      .where('schedule_slots.slot_date', date)
      .where('appointments.status', 'booked')
      .select(
        'appointments.id',
        'mothers.phone',
        'clinics.name as clinicName',
        'schedule_slots.slot_date as date',
        'schedule_slots.start_time as time'
      );

    // Cancel all appointments
    const appointmentIds = appointments.map((a) => a.id);
    if (appointmentIds.length) {
      await db('appointments')
        .whereIn('id', appointmentIds)
        .update({ status: 'cancelled', updated_at: new Date() });
    }

    // Block the slots
    await db('schedule_slots')
      .where({ clinic_id, slot_date: date })
      .update({ is_blocked: true });

    // Send bulk SMS
    const smsResults = await smsService.sendBulkCancellation(
      appointments.map((a) => ({ phone: a.phone, appointment: a })),
      reason
    );

    // Audit log
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'CANCEL_SESSION',
      details: JSON.stringify({ clinic_id, date, reason, affectedAppointments: appointmentIds.length }),
      created_at: new Date(),
    });

    res.json({
      success: true,
      message: `Session cancelled. ${appointmentIds.length} appointments affected.`,
      data: {
        cancelledCount: appointmentIds.length,
        smsResults,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all staff.
 * GET /api/admin/staff
 */
const listStaff = async (req, res, next) => {
  try {
    const staff = await db('staff')
      .select('id', 'name', 'role', 'phone', 'created_at')
      .orderBy('name');
    res.json({ success: true, data: staff });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate slots for a clinic over a date range (admin only).
 * POST /api/admin/slots/generate
 */
const generateSlots = async (req, res, next) => {
  try {
    const {
      clinic_id,
      from_date,
      to_date,
      start_time,
      end_time,
      weekdays = [1, 2, 3, 4, 5],
      staff_id = null,
    } = req.body;

    if (!clinic_id || !from_date || !to_date || !start_time || !end_time) {
      throw new AppError('clinic_id, from_date, to_date, start_time, and end_time are required.', 400, 'BAD_REQUEST');
    }

    const clinic = await db('clinics').where('id', clinic_id).first();
    if (!clinic) throw new AppError('Clinic not found.', 404, 'NOT_FOUND');

    const today = getLagosToday();
    if (from_date < today) {
      throw new AppError('Cannot generate slots for past dates.', 400, 'BAD_REQUEST');
    }
    if (to_date < from_date) {
      throw new AppError('to_date must be on or after from_date.', 400, 'BAD_REQUEST');
    }

    // Check date range <= 31 days
    const fromDateObj = new Date(from_date + 'T00:00:00Z');
    const toDateObj = new Date(to_date + 'T00:00:00Z');
    const diffTime = toDateObj.getTime() - fromDateObj.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays > 31) {
      throw new AppError('Date range cannot exceed 31 days.', 400, 'BAD_REQUEST');
    }

    const parseTimeToMinutes = (t) => {
      const parts = t.split(':').map((p) => parseInt(p, 10));
      return parts[0] * 60 + parts[1];
    };

    const formatMinutesToTime = (min) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    };

    const startMin = parseTimeToMinutes(start_time);
    const endMin = parseTimeToMinutes(end_time);
    const slotDuration = clinic.slot_duration_min || 20;

    if (startMin >= endMin || (endMin - startMin) < slotDuration) {
      throw new AppError('start_time must be earlier than end_time by at least one slot duration.', 400, 'BAD_REQUEST');
    }

    // Template slots for one day
    const dailySlotTemplates = [];
    for (let m = startMin; m + slotDuration <= endMin; m += slotDuration) {
      dailySlotTemplates.push({
        start_time: formatMinutesToTime(m),
        end_time: formatMinutesToTime(m + slotDuration),
      });
    }

    // Mark about 20% of each day's slots as walk-in (spread throughout the day, e.g. index % 5 === 2)
    const slotsWithWalkin = dailySlotTemplates.map((slot, index) => ({
      ...slot,
      is_walkin: index % 5 === 2,
    }));

    let createdCount = 0;
    let skippedCount = 0;
    const newSlotsToInsert = [];

    const current = new Date(fromDateObj);
    while (current <= toDateObj) {
      const dayOfWeek = current.getUTCDay(); // 0 = Sunday, 1 = Monday...
      const dateStr = current.toISOString().split('T')[0];

      if (weekdays.includes(dayOfWeek)) {
        const existingSlots = await db('schedule_slots')
          .where({ clinic_id, slot_date: dateStr })
          .select('start_time');

        const existingTimes = new Set(
          existingSlots.map((s) => (s.start_time.length === 5 ? `${s.start_time}:00` : s.start_time))
        );

        for (const tmpl of slotsWithWalkin) {
          if (existingTimes.has(tmpl.start_time)) {
            skippedCount++;
          } else {
            createdCount++;
            newSlotsToInsert.push({
              id: generateId(),
              clinic_id,
              staff_id: staff_id || null,
              slot_date: dateStr,
              start_time: tmpl.start_time,
              end_time: tmpl.end_time,
              is_walkin: tmpl.is_walkin,
              is_blocked: false,
              created_at: new Date(),
              updated_at: new Date(),
            });
          }
        }
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    if (newSlotsToInsert.length > 0) {
      await db.batchInsert('schedule_slots', newSlotsToInsert, 100);
    }

    // Audit log
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'GENERATE_SLOTS',
      details: JSON.stringify({
        clinic_id,
        from_date,
        to_date,
        created: createdCount,
        skipped: skippedCount,
      }),
      created_at: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Slots generated successfully.',
      data: {
        clinic_id,
        from_date,
        to_date,
        created: createdCount,
        skipped: skippedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get system audit logs.
 * GET /api/admin/audit-logs
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { action, user_id, limit = 50, offset = 0 } = req.query;

    let query = db('audit_logs')
      .select('id', 'user_id', 'action', 'details', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(Math.min(parseInt(limit, 10) || 50, 100))
      .offset(parseInt(offset, 10) || 0);

    if (action) query = query.where('action', action);
    if (user_id) query = query.where('user_id', user_id);

    const logs = await query;
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a staff member.
 * POST /api/admin/staff
 */
const createStaff = async (req, res, next) => {
  try {
    const { name, role, phone, password } = req.body;

    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
      throw new AppError('Phone number is required.', 400, 'VALIDATION_ERROR');
    }

    const formattedPhone = formatPhone(phone.trim());

    // Check duplicate phone comparing normalized values
    const existing = await db('staff').where('phone', formattedPhone).first();
    if (existing) {
      throw new AppError('A staff member with this phone number already exists.', 409, 'CONFLICT');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new AppError('Password must be at least 6 characters.', 400, 'VALIDATION_ERROR');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const id = generateId();
    const now = new Date();
    await db('staff').insert({
      id,
      name: name ? name.trim() : '',
      role,
      phone: formattedPhone,
      password_hash: passwordHash,
      created_at: now,
    });

    const staff = await db('staff')
      .where('id', id)
      .select('id', 'name', 'role', 'phone', 'created_at')
      .first();

    // Audit log (never log password)
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'CREATE_STAFF',
      details: JSON.stringify({ staffId: id, name: staff.name, role, phone: formattedPhone }),
      created_at: now,
    });

    res.status(201).json({ success: true, message: 'Staff member created.', data: staff });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a staff member.
 * PUT /api/admin/staff/:id
 */
const updateStaff = async (req, res, next) => {
  try {
    const { name, role, phone, password } = req.body;

    const existing = await db('staff').where('id', req.params.id).first();
    if (!existing) throw new AppError('Staff member not found.', 404, 'NOT_FOUND');

    const updateData = { updated_at: new Date() };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new AppError('Name cannot be empty.', 400, 'VALIDATION_ERROR');
      }
      updateData.name = name.trim();
    }

    if (role !== undefined) {
      const validRoles = ['front_desk', 'midwife', 'doctor', 'admin'];
      if (!validRoles.includes(role)) {
        throw new AppError('Invalid role specified.', 400, 'VALIDATION_ERROR');
      }
      updateData.role = role;
    }

    if (phone !== undefined) {
      if (typeof phone !== 'string' || phone.trim().length === 0) {
        throw new AppError('Phone cannot be empty.', 400, 'VALIDATION_ERROR');
      }
      const formattedPhone = formatPhone(phone.trim());
      const duplicate = await db('staff')
        .where('phone', formattedPhone)
        .whereNot('id', req.params.id)
        .first();
      if (duplicate) {
        throw new AppError('A staff member with this phone number already exists.', 409, 'CONFLICT');
      }
      updateData.phone = formattedPhone;
    }

    // Password handling:
    // Only change password if non-empty string sent (enforce minimum length 6).
    // Never hash or overwrite an empty or undefined value.
    if (password !== undefined && password !== null) {
      if (typeof password === 'string' && password.trim().length > 0) {
        if (password.length < 6) {
          throw new AppError('Password must be at least 6 characters.', 400, 'VALIDATION_ERROR');
        }
        const salt = await bcrypt.genSalt(12);
        updateData.password_hash = await bcrypt.hash(password, salt);
      }
    }

    await db('staff')
      .where('id', req.params.id)
      .update(updateData);

    const staff = await db('staff')
      .where('id', req.params.id)
      .select('id', 'name', 'role', 'phone', 'created_at')
      .first();

    // Audit log (never log password)
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'UPDATE_STAFF',
      details: JSON.stringify({
        staffId: req.params.id,
        name: staff.name,
        role: staff.role,
        phone: staff.phone,
        passwordChanged: !!updateData.password_hash,
      }),
      created_at: new Date(),
    });

    res.json({ success: true, message: 'Staff updated.', data: staff });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAppointmentReport,
  getNoShowReport,
  getClinicLoad,
  generateSlots,
  getAuditLogs,
  blockDate,
  unblockDate,
  cancelSession,
  listStaff,
  createStaff,
  updateStaff,
};
