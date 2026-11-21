const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { getLagosToday } = require('../utils/helpers');

/**
 * Get today's queue for a clinic.
 * GET /api/queue/today/:clinicId
 */
const getTodayQueue = async (req, res, next) => {
  try {
    const today = getLagosToday();

    const queue = await db('appointments')
      .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
      .join('mothers', 'appointments.mother_id', 'mothers.id')
      .where('appointments.clinic_id', req.params.clinicId)
      .where('schedule_slots.slot_date', today)
      .whereIn('appointments.status', ['checked_in', 'waiting', 'in_consultation'])
      .select(
        'appointments.id',
        'appointments.queue_number',
        'appointments.status',
        'appointments.booking_type',
        'appointments.checked_in_at',
        'mothers.name as mother_name',
        'schedule_slots.start_time'
      )
      .orderBy('appointments.checked_in_at', 'asc');

    const isStaff = req.user && ['front_desk', 'midwife', 'doctor', 'admin'].includes(req.user.role);
    const sanitizedQueue = isStaff
      ? queue
      : queue.map((q) => ({
          queue_number: q.queue_number,
          status: q.status,
          checked_in_at: q.checked_in_at,
        }));

    res.json({
      success: true,
      data: {
        clinicId: req.params.clinicId,
        date: today,
        queue: sanitizedQueue,
        totalInQueue: sanitizedQueue.length,
        currentlyServing: queue.find((q) => q.status === 'in_consultation')?.queue_number || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a mother's queue position for her appointment.
 * GET /api/queue/position/:appointmentId
 */
const getQueuePosition = async (req, res, next) => {
  try {
    const appointment = await db('appointments')
      .where('id', req.params.appointmentId)
      .first();

    if (!appointment) throw new AppError('Appointment not found.', 404, 'NOT_FOUND');

    // Security: Only owning mother or staff can view queue position
    if (req.user.role === 'mother' && appointment.mother_id !== req.user.id) {
      throw new AppError('Access denied.', 403, 'FORBIDDEN');
    }

    if (!['checked_in', 'waiting'].includes(appointment.status)) {
      return res.json({
        success: true,
        data: {
          status: appointment.status,
          queueNumber: appointment.queue_number,
          position: null,
          message: appointment.status === 'in_consultation'
            ? 'You are currently being seen.'
            : `Appointment status: ${appointment.status}`,
        },
      });
    }

    // Count how many people checked in before this patient
    const today = getLagosToday();
    const ahead = await db('appointments')
      .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
      .where('appointments.clinic_id', appointment.clinic_id)
      .where('schedule_slots.slot_date', today)
      .whereIn('appointments.status', ['checked_in', 'waiting'])
      .where('appointments.checked_in_at', '<', appointment.checked_in_at)
      .count('* as count')
      .first();

    res.json({
      success: true,
      data: {
        queueNumber: appointment.queue_number,
        position: parseInt(ahead.count) + 1,
        status: appointment.status,
        message: `You are number ${parseInt(ahead.count) + 1} in the queue.`,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTodayQueue, getQueuePosition };
