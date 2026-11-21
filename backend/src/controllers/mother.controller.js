const db = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

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
      .select('id', 'name', 'phone', 'hospital_id', 'hmo_number')
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

    res.json({
      success: true,
      data: { ...mother, babies },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, getMotherById };
