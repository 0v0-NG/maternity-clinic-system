const db = require('../config/database');
const { generateId } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

/**
 * Add a baby profile linked to the logged-in mother.
 * POST /api/babies
 */
const addBaby = async (req, res, next) => {
  try {
    const { name, date_of_birth, sex } = req.body;
    const isStaff = ['front_desk', 'admin', 'midwife', 'doctor'].includes(req.user.role);

    let targetMotherId = req.user.id;
    if (isStaff) {
      if (req.body.mother_id) {
        const mother = await db('mothers').where('id', req.body.mother_id).first();
        if (!mother) {
          throw new AppError('Mother not found.', 404, 'NOT_FOUND');
        }
        targetMotherId = req.body.mother_id;
      } else {
        throw new AppError('Mother ID is required when staff creates a baby.', 422, 'VALIDATION_ERROR');
      }
    } else {
      // Mother always uses her own id; ignore any mother_id sent
      targetMotherId = req.user.id;
    }

    const id = generateId();
    await db('babies')
      .insert({
        id,
        mother_id: targetMotherId,
        name,
        date_of_birth,
        sex,
        created_at: new Date(),
      });

    if (isStaff) {
      await db('audit_logs').insert({
        id: generateId(),
        user_id: req.user.id,
        action: 'STAFF_ADD_BABY',
        details: JSON.stringify({ staffId: req.user.id, motherId: targetMotherId, babyId: id }),
        created_at: new Date(),
      });
    }

    const baby = await db('babies').where('id', id).first();

    res.status(201).json({
      success: true,
      message: 'Baby profile added successfully.',
      data: baby,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all babies for the logged-in mother.
 * GET /api/babies
 */
const listBabies = async (req, res, next) => {
  try {
    const babies = await db('babies')
      .where('mother_id', req.user.id)
      .select('id', 'name', 'date_of_birth', 'sex', 'created_at')
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: babies,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a baby profile.
 * PUT /api/babies/:id
 */
const updateBaby = async (req, res, next) => {
  try {
    const { name, date_of_birth, sex } = req.body;

    // Verify ownership
    const baby = await db('babies')
      .where({ id: req.params.id, mother_id: req.user.id })
      .first();

    if (!baby) {
      throw new AppError('Baby profile not found.', 404);
    }

    await db('babies')
      .where('id', req.params.id)
      .update({ name, date_of_birth, sex, updated_at: new Date() });

    const updated = await db('babies').where('id', req.params.id).first();

    res.json({
      success: true,
      message: 'Baby profile updated.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a baby profile.
 * DELETE /api/babies/:id
 */
const deleteBaby = async (req, res, next) => {
  try {
    const baby = await db('babies')
      .where({ id: req.params.id, mother_id: req.user.id })
      .first();

    if (!baby) {
      throw new AppError('Baby profile not found.', 404);
    }

    await db('babies').where('id', req.params.id).del();

    res.json({
      success: true,
      message: 'Baby profile removed.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { addBaby, listBabies, updateBaby, deleteBaby };
