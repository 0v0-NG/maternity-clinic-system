const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const babyController = require('../controllers/baby.controller');

const router = Router();

router.use(authenticate);

router.post(
  '/',
  validate([
    body('name').trim().notEmpty().withMessage('Baby name is required.'),
    body('date_of_birth').isDate().withMessage('Valid date of birth is required.'),
    body('sex').isIn(['male', 'female']).withMessage('Sex must be male or female.'),
    body('mother_id').optional().isUUID().withMessage('Valid mother ID is required if provided.'),
  ]),
  babyController.addBaby
);

router.get('/', babyController.listBabies);

router.put(
  '/:id',
  validate([
    body('name').optional().trim().notEmpty(),
    body('date_of_birth').optional().isDate(),
    body('sex').optional().isIn(['male', 'female']),
  ]),
  babyController.updateBaby
);

router.delete('/:id', babyController.deleteBaby);

module.exports = router;
