const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const appointmentController = require('../controllers/appointment.controller');

const router = Router();

router.use(authenticate);

// Mother books an appointment
router.post(
  '/',
  validate([
    body('slot_id').notEmpty().withMessage('Slot ID is required.'),
    body('clinic_id').notEmpty().withMessage('Clinic ID is required.'),
    body('booking_type').optional().isString(),
    body('baby_ids').optional().isArray(),
  ]),
  appointmentController.bookAppointment
);

// Get my appointments (mother) or query params for staff
router.get('/', appointmentController.getMyAppointments);
router.get('/:id', appointmentController.getAppointment);

// Reschedule
router.put(
  '/:id/reschedule',
  validate([
    body('new_slot_id').notEmpty().withMessage('New slot ID is required.'),
    body('booking_type').optional().isString(),
    body('baby_ids').optional().isArray(),
  ]),
  appointmentController.rescheduleAppointment
);

// Cancel
router.put('/:id/cancel', appointmentController.cancelAppointment);

// Staff: check in
router.post(
  '/:id/checkin',
  authorize('front_desk', 'admin'),
  appointmentController.checkIn
);

// Staff: update visit status
router.put(
  '/:id/status',
  authorize('front_desk', 'midwife', 'doctor', 'admin'),
  validate([
    body('status')
      .isIn(['waiting', 'in_consultation', 'completed', 'no_show'])
      .withMessage('Invalid status.'),
  ]),
  appointmentController.updateStatus
);

// Staff: book follow-up
router.post(
  '/follow-up',
  authorize('midwife', 'doctor', 'front_desk', 'admin'),
  validate([
    body('mother_id').notEmpty().withMessage('Mother ID is required.'),
    body('clinic_id').notEmpty().withMessage('Clinic ID is required.'),
    body('slot_id').notEmpty().withMessage('Slot ID is required.'),
    body('booking_type').optional().isString(),
    body('baby_ids').optional().isArray(),
  ]),
  appointmentController.bookFollowUp
);

module.exports = router;
