const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { generateId } = require('../utils/helpers');
const smsService = require('../services/sms.service');
const { AppError } = require('../middleware/errorHandler');

/**
 * Get appointment report (appointments per clinic, daily/weekly/monthly).
 * GET /api/admin/reports/appointments?period=daily&date=2024-01-15
 */
const getAppointmentReport = async (req, res, next) => {
  try {
    const { period = 'daily', date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

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
    const date = req.query.date || new Date().toISOString().split('T')[0];

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
 * Create a staff member.
 * POST /api/admin/staff
 */
const createStaff = async (req, res, next) => {
  try {
    const { name, role, phone, password } = req.body;

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const id = generateId();
    const [staff] = await db('staff')
      .insert({ id, name, role, phone, password_hash: passwordHash, created_at: new Date() })
      .returning(['id', 'name', 'role', 'phone']);

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
    const { name, role, phone } = req.body;

    const [staff] = await db('staff')
      .where('id', req.params.id)
      .update({ name, role, phone, updated_at: new Date() })
      .returning(['id', 'name', 'role', 'phone']);

    if (!staff) throw new AppError('Staff member not found.', 404);

    res.json({ success: true, message: 'Staff updated.', data: staff });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAppointmentReport,
  getNoShowReport,
  getClinicLoad,
  blockDate,
  unblockDate,
  cancelSession,
  listStaff,
  createStaff,
  updateStaff,
};
