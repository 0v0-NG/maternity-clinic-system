const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const queueController = require('../controllers/queue.controller');

const router = Router();

router.use(authenticate);

// Get today's queue for a clinic (staff and mothers)
router.get('/today/:clinicId', queueController.getTodayQueue);

// Get a mother's queue position
router.get('/position/:appointmentId', queueController.getQueuePosition);

module.exports = router;
