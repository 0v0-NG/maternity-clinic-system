const cron = require('node-cron');
const db = require('../config/database');
const smsService = require('./sms.service');
const config = require('../config');

/**
 * Reminder Service
 * Runs scheduled jobs to send SMS reminders before appointments.
 */
class ReminderService {
  /**
   * Start the reminder cron job.
   * Runs every 30 minutes to check for upcoming appointments.
   */
  start() {
    console.log('[Reminder] Service started — checking every 30 minutes');

    cron.schedule('*/30 * * * *', async () => {
      console.log(`[Reminder] Running check at ${new Date().toISOString()}`);
      await this.processReminders();
    });
  }

  /**
   * Check for appointments that need reminders and send them.
   */
  async processReminders() {
    try {
      for (const hours of config.reminderHours) {
        await this.sendRemindersForWindow(hours);
      }
    } catch (error) {
      console.error('[Reminder] Error processing reminders:', error.message);
    }
  }

  /**
   * Send reminders for appointments due in a given number of hours.
   * @param {number} hours - Hours before appointment
   */
  async sendRemindersForWindow(hours) {
    const reminderField = `reminder_${hours}h_sent`;
    const now = new Date();
    const targetTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const windowStart = new Date(targetTime.getTime() - 15 * 60 * 1000);
    const windowEnd = new Date(targetTime.getTime() + 15 * 60 * 1000);

    try {
      const isPg = db.client.config.client === 'pg';
      const dateExpr = isPg
        ? `(schedule_slots.slot_date || ' ' || schedule_slots.start_time)::timestamp`
        : `datetime(schedule_slots.slot_date || ' ' || schedule_slots.start_time)`;
      const startVal = isPg
        ? windowStart.toISOString()
        : windowStart.toISOString().replace('T', ' ').substring(0, 19);
      const endVal = isPg
        ? windowEnd.toISOString()
        : windowEnd.toISOString().replace('T', ' ').substring(0, 19);

      const appointments = await db('appointments')
        .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
        .join('mothers', 'appointments.mother_id', 'mothers.id')
        .join('clinics', 'appointments.clinic_id', 'clinics.id')
        .where('appointments.status', 'booked')
        .where(`appointments.${reminderField}`, false)
        .whereRaw(`${dateExpr} BETWEEN ? AND ?`, [startVal, endVal])
        .select(
          'appointments.id',
          'mothers.phone',
          'clinics.name as clinicName',
          'schedule_slots.slot_date as date',
          'schedule_slots.start_time as time',
          'appointments.booking_type as bookingFor'
        );

      console.log(`[Reminder] Found ${appointments.length} appointments needing ${hours}h reminder`);

      for (const appt of appointments) {
        try {
          await smsService.sendReminder(appt.phone, appt, hours);
          await db('appointments')
            .where('id', appt.id)
            .update({ [reminderField]: true });
        } catch (err) {
          console.error(`[Reminder] Failed for appointment ${appt.id}:`, err.message);
        }
      }
    } catch (error) {
      console.error(`[Reminder] Query error for ${hours}h window:`, error.message);
    }
  }
}

module.exports = new ReminderService();
