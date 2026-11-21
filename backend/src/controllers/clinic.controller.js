const db = require('../config/database');
const { generateId } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

/**
 * List all clinics.
 * GET /api/clinics
 */
const listClinics = async (req, res, next) => {
  try {
    const clinics = await db('clinics').select('*').orderBy('name');
    res.json({ success: true, data: clinics });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single clinic by ID.
 * GET /api/clinics/:id
 */
const getClinic = async (req, res, next) => {
  try {
    const clinic = await db('clinics').where('id', req.params.id).first();
    if (!clinic) throw new AppError('Clinic not found.', 404);

    // Get assigned staff
    const staff = await db('clinic_staff')
      .join('staff', 'clinic_staff.staff_id', 'staff.id')
      .where('clinic_staff.clinic_id', req.params.id)
      .select('staff.id', 'staff.name', 'staff.role');

    res.json({ success: true, data: { ...clinic, staff } });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new clinic (admin only).
 * POST /api/clinics
 */
const createClinic = async (req, res, next) => {
  try {
    const { name, slot_duration_min, walkin_reserve_pct } = req.body;

    const id = generateId();
    await db('clinics')
      .insert({
        id,
        name,
        slot_duration_min: slot_duration_min || 20,
        walkin_reserve_pct: walkin_reserve_pct || 0.2,
        created_at: new Date(),
      });
    const clinic = await db('clinics').where('id', id).first();

    res.status(201).json({
      success: true,
      message: 'Clinic created.',
      data: clinic,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a clinic (admin only).
 * PUT /api/clinics/:id
 */
const updateClinic = async (req, res, next) => {
  try {
    const { name, slot_duration_min, walkin_reserve_pct } = req.body;

    await db('clinics')
      .where('id', req.params.id)
      .update({ name, slot_duration_min, walkin_reserve_pct, updated_at: new Date() });

    const clinic = await db('clinics').where('id', req.params.id).first();

    if (!clinic) throw new AppError('Clinic not found.', 404);

    res.json({ success: true, message: 'Clinic updated.', data: clinic });
  } catch (error) {
    next(error);
  }
};

/**
 * Get available slots for a clinic on a given date.
 * GET /api/clinics/:id/slots?date=YYYY-MM-DD
 */
const getAvailableSlots = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) throw new AppError('Date query parameter is required.', 400);

    let query = db('schedule_slots')
      .leftJoin('appointments', function () {
        this.on('schedule_slots.id', 'appointments.slot_id')
          .andOnIn('appointments.status', ['booked', 'checked_in']);
      })
      .where('schedule_slots.clinic_id', req.params.id)
      .where('schedule_slots.slot_date', date)
      .where('schedule_slots.is_blocked', false)
      .whereNull('appointments.id');

    // Exclude walk-in slots when caller is a mother or unauthenticated.
    // Front desk and admin (staff) can see walk-in slots.
    const isStaff = req.user && ['front_desk', 'admin', 'midwife', 'doctor'].includes(req.user.role);
    if (!isStaff) {
      query = query.where('schedule_slots.is_walkin', false);
    }

    const slots = await query
      .select(
        'schedule_slots.id',
        'schedule_slots.start_time',
        'schedule_slots.end_time',
        'schedule_slots.is_walkin',
        'schedule_slots.staff_id'
      )
      .orderBy('schedule_slots.start_time');

    // Get staff names for the slots
    const staffIds = [...new Set(slots.map((s) => s.staff_id).filter(Boolean))];
    const staffMap = {};
    if (staffIds.length) {
      const staffRows = await db('staff').whereIn('id', staffIds).select('id', 'name');
      staffRows.forEach((s) => (staffMap[s.id] = s.name));
    }

    const enriched = slots.map((s) => ({
      ...s,
      staffName: staffMap[s.staff_id] || null,
    }));

    res.json({
      success: true,
      data: {
        clinicId: req.params.id,
        date,
        availableSlots: enriched,
        totalAvailable: enriched.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { listClinics, getClinic, createClinic, updateClinic, getAvailableSlots };
