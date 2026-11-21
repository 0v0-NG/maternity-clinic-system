const db = require('../config/database');
const {
  generateId,
  isWithinCutoff,
  generateQueueNumber,
  getLagosToday,
  isWithinCutoffLagos,
  parseLagosDateTime,
} = require('../utils/helpers');
const smsService = require('../services/sms.service');
const config = require('../config');
const { AppError } = require('../middleware/errorHandler');

/**
 * Book a new appointment.
 * POST /api/appointments
 */
const bookAppointment = async (req, res, next) => {
  try {
    const { slot_id, clinic_id, booking_type, baby_ids } = req.body;
    const mother_id = req.user.role === 'mother' ? req.user.id : req.body.mother_id;

    // Use a transaction with row-level locking to prevent double-booking
    const result = await db.transaction(async (trx) => {
      // 1. Lock the mother's row first to serialize concurrent requests from the same mother
      const motherLock = await trx('mothers')
        .where('id', mother_id)
        .forUpdate()
        .first();

      if (!motherLock) throw new AppError('Mother not found.', 404, 'NOT_FOUND');

      // 2. Lock the slot row
      const slot = await trx('schedule_slots')
        .where('id', slot_id)
        .forUpdate()
        .first();

      if (!slot) throw new AppError('Slot not found.', 404, 'NOT_FOUND');
      if (slot.is_blocked) throw new AppError('This slot is blocked.', 400, 'BAD_REQUEST');

      // Reject mothers attempting to book reserved walk-in slots
      if (slot.is_walkin && req.user.role === 'mother') {
        throw new AppError('This slot is reserved for walk-in patients.', 400, 'SLOT_RESERVED');
      }

      // Check if slot is already taken by any non-cancelled appointment
      const existingBooking = await trx('appointments')
        .where('slot_id', slot_id)
        .where('status', '!=', 'cancelled')
        .first();

      if (existingBooking) {
        throw new AppError('This slot is already booked. Please choose another.', 409, 'SLOT_TAKEN');
      }

      // Check if mother already has an overlapping appointment
      const overlapping = await trx('appointments')
        .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
        .where('appointments.mother_id', mother_id)
        .where('schedule_slots.slot_date', slot.slot_date)
        .where('appointments.status', '!=', 'cancelled')
        .where(function () {
          this.where('schedule_slots.start_time', '<', slot.end_time)
            .andWhere('schedule_slots.end_time', '>', slot.start_time);
        })
        .first();

      if (overlapping) {
        throw new AppError('You already have an appointment during this time.', 409, 'OVERLAP');
      }

      // Create the appointment
      const appointmentId = generateId();
      const apptTime = parseLagosDateTime(slot.slot_date, slot.start_time);
      const isLessThan24hAhead = (apptTime.getTime() - Date.now()) < 24 * 60 * 60 * 1000;

      await trx('appointments')
        .insert({
          id: appointmentId,
          mother_id,
          clinic_id,
          staff_id: slot.staff_id,
          slot_id,
          status: 'booked',
          booking_type: booking_type || 'mother',
          booked_at: new Date(),
          reminder_24h_sent: isLessThan24hAhead,
          reminder_2h_sent: false,
        });

      const appointment = await trx('appointments').where('id', appointmentId).first();

      // Link babies if booking includes baby
      if (baby_ids && baby_ids.length > 0 && ['baby', 'both'].includes(booking_type)) {
        const babyLinks = baby_ids.map((babyId) => ({
          appointment_id: appointmentId,
          baby_id: babyId,
        }));
        await trx('appointment_babies').insert(babyLinks);
      }

      return appointment;
    });

    // Send confirmation SMS
    const mother = await db('mothers').where('id', mother_id).first();
    const clinic = await db('clinics').where('id', clinic_id).first();
    const slot = await db('schedule_slots').where('id', slot_id).first();

    try {
      await smsService.sendBookingConfirmation(mother.phone, {
        clinicName: clinic.name,
        date: slot.slot_date,
        time: slot.start_time,
        bookingFor: booking_type,
      });
    } catch (smsErr) {
      console.error('[Appointment] SMS confirmation failed:', smsErr.message);
    }

    // Audit log
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'BOOK_APPOINTMENT',
      details: JSON.stringify({ appointmentId: result.id, clinic_id, slot_id }),
      created_at: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully.',
      data: result,
    });
  } catch (error) {
    if (
      error.code === '23505' ||
      error.code === 'SQLITE_CONSTRAINT' ||
      error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (error.message && (
        error.message.includes('idx_appointments_slot_active') ||
        error.message.includes('appointments.slot_id') ||
        error.message.includes('UNIQUE constraint failed') ||
        error.message.includes('unique constraint')
      ))
    ) {
      return next(new AppError('This slot is already booked. Please choose another.', 409, 'SLOT_TAKEN'));
    }
    next(error);
  }
};

/**
 * Get the logged-in mother's appointments (or staff query).
 * GET /api/appointments?view=upcoming|past
 */
const getMyAppointments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, upcoming, view } = req.query;

    let query = db('appointments')
      .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
      .join('clinics', 'appointments.clinic_id', 'clinics.id')
      .leftJoin('staff', 'appointments.staff_id', 'staff.id');

    if (req.user.role === 'mother') {
      query = query.where('appointments.mother_id', userId);
    } else if (req.query.mother_id) {
      query = query.where('appointments.mother_id', req.query.mother_id);
    }

    query = query.select(
      'appointments.*',
      'schedule_slots.slot_date',
      'schedule_slots.start_time',
      'schedule_slots.end_time',
      'clinics.name as clinic_name',
      'staff.name as staff_name'
    );

    // Determine view: 'upcoming' (default) vs 'past'
    const isPast = view === 'past' || upcoming === 'false';
    const today = getLagosToday();

    if (isPast) {
      // Past returns attended ('completed'), cancelled, and no-show appointments, or past dates
      query = query.where(function () {
        this.whereIn('appointments.status', ['completed', 'cancelled', 'no_show'])
          .orWhere('schedule_slots.slot_date', '<', today);
      });
    } else {
      // Default: upcoming appointments (active/booked from today forward)
      query = query.where(function () {
        this.whereNotIn('appointments.status', ['completed', 'cancelled', 'no_show'])
          .andWhere('schedule_slots.slot_date', '>=', today);
      });
    }

    if (status) query = query.where('appointments.status', status);

    // Order newest first
    query = query
      .orderBy('schedule_slots.slot_date', 'desc')
      .orderBy('schedule_slots.start_time', 'desc');

    const appointments = await query;

    // Get linked babies for each appointment
    for (const appt of appointments) {
      appt.babies = await db('appointment_babies')
        .join('babies', 'appointment_babies.baby_id', 'babies.id')
        .where('appointment_babies.appointment_id', appt.id)
        .select('babies.id', 'babies.name');
    }

    res.json({ success: true, data: appointments });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single appointment by ID.
 * GET /api/appointments/:id
 */
const getAppointment = async (req, res, next) => {
  try {
    const appointment = await db('appointments')
      .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
      .join('clinics', 'appointments.clinic_id', 'clinics.id')
      .leftJoin('staff', 'appointments.staff_id', 'staff.id')
      .where('appointments.id', req.params.id)
      .select(
        'appointments.*',
        'schedule_slots.slot_date',
        'schedule_slots.start_time',
        'schedule_slots.end_time',
        'clinics.name as clinic_name',
        'staff.name as staff_name'
      )
      .first();

    if (!appointment) throw new AppError('Appointment not found.', 404, 'NOT_FOUND');

    // Check access: mother can only see her own, staff can see all
    if (req.user.role === 'mother' && appointment.mother_id !== req.user.id) {
      throw new AppError('Access denied.', 403, 'FORBIDDEN');
    }

    appointment.babies = await db('appointment_babies')
      .join('babies', 'appointment_babies.baby_id', 'babies.id')
      .where('appointment_babies.appointment_id', appointment.id)
      .select('babies.id', 'babies.name');

    res.json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
};

/**
 * Reschedule an appointment to a new slot.
 * PUT /api/appointments/:id/reschedule
 */
const rescheduleAppointment = async (req, res, next) => {
  try {
    const { new_slot_id } = req.body;

    const appointment = await db('appointments').where('id', req.params.id).first();
    if (!appointment) throw new AppError('Appointment not found.', 404, 'NOT_FOUND');
    if (req.user.role === 'mother' && appointment.mother_id !== req.user.id) {
      throw new AppError('Access denied.', 403, 'FORBIDDEN');
    }
    if (appointment.status !== 'booked') throw new AppError('Only booked appointments can be rescheduled.', 400, 'BAD_REQUEST');

    // Check cutoff
    const slot = await db('schedule_slots').where('id', appointment.slot_id).first();
    if (!isWithinCutoffLagos(slot.slot_date, slot.start_time, config.cancelCutoffHours)) {
      throw new AppError(`Cannot reschedule within ${config.cancelCutoffHours} hours of the appointment.`, 400, 'CUTOFF_PASSED');
    }

    // Book the new slot (with locking)
    await db.transaction(async (trx) => {
      // 1. Lock the mother's row first to serialize concurrent requests
      const motherLock = await trx('mothers').where('id', appointment.mother_id).forUpdate().first();
      if (!motherLock) throw new AppError('Mother not found.', 404, 'NOT_FOUND');

      // 2. Lock the new slot row
      const newSlot = await trx('schedule_slots').where('id', new_slot_id).forUpdate().first();
      if (!newSlot) throw new AppError('New slot not found.', 404, 'NOT_FOUND');
      if (newSlot.is_blocked) throw new AppError('This slot is blocked.', 400, 'BAD_REQUEST');
      if (newSlot.is_walkin && req.user.role === 'mother') {
        throw new AppError('This slot is reserved for walk-in patients.', 400, 'SLOT_RESERVED');
      }

      const taken = await trx('appointments')
        .where('slot_id', new_slot_id)
        .where('status', '!=', 'cancelled')
        .first();
      if (taken) throw new AppError('New slot is already booked.', 409, 'SLOT_TAKEN');

      // Check overlapping appointment on the new slot date/time
      const overlapping = await trx('appointments')
        .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
        .where('appointments.mother_id', appointment.mother_id)
        .where('appointments.id', '!=', req.params.id)
        .where('schedule_slots.slot_date', newSlot.slot_date)
        .where('appointments.status', '!=', 'cancelled')
        .where(function () {
          this.where('schedule_slots.start_time', '<', newSlot.end_time)
            .andWhere('schedule_slots.end_time', '>', newSlot.start_time);
        })
        .first();

      if (overlapping) {
        throw new AppError('You already have an appointment during this time.', 409, 'OVERLAP');
      }

      await trx('appointments')
        .where('id', req.params.id)
        .update({
          slot_id: new_slot_id,
          staff_id: newSlot.staff_id,
          reminder_24h_sent: false,
          reminder_2h_sent: false,
          updated_at: new Date(),
        });
    });

    // Send confirmation SMS
    const mother = await db('mothers').where('id', appointment.mother_id).first();
    const newSlot = await db('schedule_slots').where('id', new_slot_id).first();
    const clinic = await db('clinics').where('id', appointment.clinic_id).first();

    try {
      await smsService.sendSMS(
        mother.phone,
        `Your ${clinic.name} appointment has been rescheduled to ${newSlot.slot_date} at ${newSlot.start_time}.`
      );
    } catch (smsErr) {
      console.error('[Appointment] Reschedule SMS failed:', smsErr.message);
    }

    // Audit log
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'RESCHEDULE_APPOINTMENT',
      details: JSON.stringify({ appointmentId: req.params.id, old_slot_id: appointment.slot_id, new_slot_id }),
      created_at: new Date(),
    });

    res.json({ success: true, message: 'Appointment rescheduled successfully.' });
  } catch (error) {
    if (
      error.code === '23505' ||
      error.code === 'SQLITE_CONSTRAINT' ||
      error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (error.message && (
        error.message.includes('idx_appointments_slot_active') ||
        error.message.includes('appointments.slot_id') ||
        error.message.includes('UNIQUE constraint failed') ||
        error.message.includes('unique constraint')
      ))
    ) {
      return next(new AppError('New slot is already booked.', 409, 'SLOT_TAKEN'));
    }
    next(error);
  }
};

/**
 * Cancel an appointment.
 * PUT /api/appointments/:id/cancel
 */
const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await db('appointments').where('id', req.params.id).first();
    if (!appointment) throw new AppError('Appointment not found.', 404, 'NOT_FOUND');
    if (req.user.role === 'mother' && appointment.mother_id !== req.user.id) {
      throw new AppError('Access denied.', 403, 'FORBIDDEN');
    }
    if (appointment.status !== 'booked') throw new AppError('Only booked appointments can be cancelled.', 400, 'BAD_REQUEST');

    const slot = await db('schedule_slots').where('id', appointment.slot_id).first();
    if (!isWithinCutoffLagos(slot.slot_date, slot.start_time, config.cancelCutoffHours)) {
      throw new AppError(`Cannot cancel within ${config.cancelCutoffHours} hours of the appointment.`, 400, 'CUTOFF_PASSED');
    }

    await db('appointments')
      .where('id', req.params.id)
      .update({ status: 'cancelled', updated_at: new Date() });

    // Send SMS
    const mother = await db('mothers').where('id', appointment.mother_id).first();
    const clinic = await db('clinics').where('id', appointment.clinic_id).first();
    try {
      await smsService.sendSMS(
        mother.phone,
        `Your ${clinic.name} appointment on ${slot.slot_date} at ${slot.start_time} has been cancelled.`
      );
    } catch (smsErr) {
      console.error('[Appointment] Cancel SMS failed:', smsErr.message);
    }

    // Audit log
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'CANCEL_APPOINTMENT',
      details: JSON.stringify({ appointmentId: req.params.id, slot_id: appointment.slot_id }),
      created_at: new Date(),
    });

    res.json({ success: true, message: 'Appointment cancelled.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Check in a patient (front desk).
 * POST /api/appointments/:id/checkin
 */
const checkIn = async (req, res, next) => {
  try {
    const appointment = await db('appointments')
      .join('clinics', 'appointments.clinic_id', 'clinics.id')
      .where('appointments.id', req.params.id)
      .select('appointments.*', 'clinics.name as clinic_name')
      .first();

    if (!appointment) throw new AppError('Appointment not found.', 404);
    if (appointment.status !== 'booked') throw new AppError('Only booked appointments can be checked in.', 400);

    // Count today's check-ins for this clinic to generate queue number
    const today = getLagosToday();
    const checkedInCount = await db('appointments')
      .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
      .where('appointments.clinic_id', appointment.clinic_id)
      .where('schedule_slots.slot_date', today)
      .where('appointments.status', 'checked_in')
      .count('* as count')
      .first();

    const prefix = appointment.clinic_name.includes('Antenatal') ? 'ANC' : 'PNC';
    const queueNumber = generateQueueNumber(prefix, parseInt(checkedInCount.count));

    await db('appointments')
      .where('id', req.params.id)
      .update({
        status: 'checked_in',
        queue_number: queueNumber,
        checked_in_at: new Date(),
        updated_at: new Date(),
      });

    // Audit log
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'CHECKIN_PATIENT',
      details: JSON.stringify({ appointmentId: req.params.id, queueNumber }),
      created_at: new Date(),
    });

    res.json({
      success: true,
      message: 'Patient checked in.',
      data: { queueNumber },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update visit status (midwife/doctor).
 * PUT /api/appointments/:id/status
 */
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['waiting', 'in_consultation', 'completed', 'no_show'];

    if (!allowedStatuses.includes(status)) {
      throw new AppError(`Status must be one of: ${allowedStatuses.join(', ')}`, 400);
    }

    const appointment = await db('appointments').where('id', req.params.id).first();
    if (!appointment) throw new AppError('Appointment not found.', 404);

    await db('appointments')
      .where('id', req.params.id)
      .update({ status, updated_at: new Date() });

    // Audit log
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'UPDATE_APPOINTMENT_STATUS',
      details: JSON.stringify({ appointmentId: req.params.id, previous_status: appointment.status, status }),
      created_at: new Date(),
    });

    res.json({ success: true, message: `Appointment status updated to ${status}.` });
  } catch (error) {
    next(error);
  }
};

/**
 * Book a follow-up appointment (staff).
 * POST /api/appointments/follow-up
 */
const bookFollowUp = async (req, res, next) => {
  try {
    const { mother_id, clinic_id, slot_id, booking_type, baby_ids } = req.body;

    // Reuse the booking logic
    req.body = { mother_id, clinic_id, slot_id, booking_type, baby_ids };
    return bookAppointment(req, res, next);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  bookAppointment,
  getMyAppointments,
  getAppointment,
  rescheduleAppointment,
  cancelAppointment,
  checkIn,
  updateStatus,
  bookFollowUp,
};
