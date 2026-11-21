const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const { generateId, formatPhone } = require('../utils/helpers');

/**
 * Get the logged-in mother's profile.
 * GET /api/mothers/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const mother = await db('mothers')
      .where('id', req.user.id)
      .select('id', 'name', 'phone', 'hospital_id', 'hmo_number', 'created_at')
      .first();

    if (!mother) {
      throw new AppError('Profile not found.', 404);
    }

    // Get linked babies
    const babies = await db('babies').where('mother_id', req.user.id)
      .select('id', 'name', 'date_of_birth', 'sex', 'created_at');

    res.json({
      success: true,
      data: { ...mother, babies },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update the logged-in mother's profile.
 * PUT /api/mothers/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, hospital_id, hmo_number } = req.body;

    await db('mothers')
      .where('id', req.user.id)
      .update({
        name,
        hospital_id,
        hmo_number,
        updated_at: new Date(),
      });

    const mother = await db('mothers')
      .where('id', req.user.id)
      .select('id', 'name', 'phone', 'hospital_id', 'hmo_number', 'created_at')
      .first();

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: mother,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a mother's profile by ID (staff only).
 * GET /api/mothers/:id
 */
const getMotherById = async (req, res, next) => {
  try {
    const mother = await db('mothers')
      .where('id', req.params.id)
      .select('id', 'name', 'phone', 'hospital_id', 'hmo_number', 'created_at')
      .first();

    if (!mother) {
      throw new AppError('Mother not found.', 404);
    }

    const babies = await db('babies').where('mother_id', req.params.id)
      .select('id', 'name', 'date_of_birth', 'sex');

    // Audit log: staff viewing mother profile
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'STAFF_VIEW_MOTHER_PROFILE',
      details: JSON.stringify({ staffId: req.user.id, motherId: req.params.id }),
      created_at: new Date(),
    });

    res.json({
      success: true,
      data: { ...mother, babies },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search mothers by name or phone (front desk and admin only).
 * GET /api/mothers/search?q=
 */
const searchMothers = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 3) {
      throw new AppError('Search query must be at least 3 characters.', 422, 'VALIDATION_ERROR');
    }

    const cleanQ = q.trim();
    const namePattern = `%${cleanQ.toLowerCase()}%`;
    const digits = cleanQ.replace(/\D/g, '');

    const query = db('mothers')
      .where(function () {
        this.whereRaw('LOWER(mothers.name) LIKE ?', [namePattern]);
        this.orWhere('mothers.phone', 'LIKE', `%${cleanQ}%`);

        if (digits.length >= 3) {
          this.orWhere('mothers.phone', 'LIKE', `%${digits}%`);
          if (digits.startsWith('0')) {
            const withoutZero = digits.slice(1);
            this.orWhere('mothers.phone', 'LIKE', `%+234${withoutZero}%`);
          } else if (digits.startsWith('234')) {
            const without234 = digits.slice(3);
            this.orWhere('mothers.phone', 'LIKE', `%+234${without234}%`);
          } else {
            this.orWhere('mothers.phone', 'LIKE', `%+234${digits}%`);
          }
        }
      })
      .limit(20)
      .select('id', 'name', 'phone', 'hospital_id', 'hmo_number', 'registered_by_staff');

    const mothers = await query;
    const motherIds = mothers.map((m) => m.id);

    let babiesByMotherId = {};
    if (motherIds.length > 0) {
      const babies = await db('babies')
        .whereIn('mother_id', motherIds)
        .select('id', 'mother_id', 'name', 'date_of_birth', 'sex');

      for (const b of babies) {
        if (!babiesByMotherId[b.mother_id]) {
          babiesByMotherId[b.mother_id] = [];
        }
        babiesByMotherId[b.mother_id].push({
          id: b.id,
          name: b.name,
          date_of_birth: b.date_of_birth,
          sex: b.sex,
        });
      }
    }

    const formatted = mothers.map((m) => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      hospital_id: m.hospital_id,
      hmo_number: m.hmo_number,
      registered_by_staff: Boolean(m.registered_by_staff),
      babies: babiesByMotherId[m.id] || [],
    }));

    // Audit-log the search with the result count only. Never log the search text itself.
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'STAFF_SEARCH_MOTHERS',
      details: JSON.stringify({ resultCount: formatted.length }),
      created_at: new Date(),
    });

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register a mother in-person at the front desk (front_desk and admin only).
 * POST /api/mothers
 */
const registerMotherByStaff = async (req, res, next) => {
  try {
    const { name, phone, hospital_id, hmo_number, consent_confirmed } = req.body;

    if (consent_confirmed !== true) {
      throw new AppError('Patient verbal consent is required for staff registration.', 400, 'CONSENT_REQUIRED');
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new AppError('Mother name is required.', 422, 'VALIDATION_ERROR');
    }

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      throw new AppError('Phone number is required.', 422, 'VALIDATION_ERROR');
    }

    const formattedPhone = formatPhone(phone.trim());

    // Check duplicate phone
    const existing = await db('mothers').where('phone', formattedPhone).first();
    if (existing) {
      throw new AppError(
        'A patient with this phone number is already registered. Please search for her instead.',
        409,
        'CONFLICT'
      );
    }

    const trimmedHospitalId =
      hospital_id && typeof hospital_id === 'string' && hospital_id.trim() ? hospital_id.trim() : null;
    const trimmedHmoNumber =
      hmo_number && typeof hmo_number === 'string' && hmo_number.trim() ? hmo_number.trim() : null;

    // Create unusable random password hash so account cannot be logged in until self-registered
    const randomSecret = crypto.randomBytes(32).toString('hex');
    const password_hash = await bcrypt.hash(randomSecret, 10);

    const id = generateId();
    const now = new Date();

    await db('mothers').insert({
      id,
      name: name.trim(),
      phone: formattedPhone,
      hospital_id: trimmedHospitalId,
      hmo_number: trimmedHmoNumber,
      password_hash,
      is_verified: true,
      consent_at: now,
      registered_by_staff: true,
      created_at: now,
    });

    // Audit log
    await db('audit_logs').insert({
      id: generateId(),
      user_id: req.user.id,
      action: 'CREATE_MOTHER_BY_STAFF',
      details: JSON.stringify({ staffId: req.user.id, motherId: id }),
      created_at: now,
    });

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully.',
      data: {
        id,
        name: name.trim(),
        phone: formattedPhone,
        hospital_id: trimmedHospitalId,
        hmo_number: trimmedHmoNumber,
        registered_by_staff: true,
        created_at: now,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getMotherById,
  searchMothers,
  registerMotherByStaff,
};
