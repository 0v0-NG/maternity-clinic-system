const cron = require('node-cron');
const db = require('../config/database');
const smsService = require('./sms.service');
const config = require('../config');
const { getReminderWindowLagos, parseLagosDateTime } = require('../utils/helpers');

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
    const { startString, endString } = getReminderWindowLagos(hours);

    try {
      const isPg = db.client.config.client === 'pg';
      const dateExpr = isPg
        ? `(schedule_slots.slot_date || ' ' || schedule_slots.start_time)::timestamp`
        : `datetime(schedule_slots.slot_date || ' ' || schedule_slots.start_time)`;

      const appointments = await db('appointments')
        .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
        .join('mothers', 'appointments.mother_id', 'mothers.id')
        .join('clinics', 'appointments.clinic_id', 'clinics.id')
        .where('appointments.status', 'booked')
        .where(`appointments.${reminderField}`, false)
        .whereRaw(`${dateExpr} BETWEEN ? AND ?`, [startString, endString])
        .select(
          'appointments.id',
          'appointments.booked_at',
          'mothers.phone',
          'clinics.name as clinicName',
          'schedule_slots.slot_date as date',
          'schedule_slots.start_time as time',
          'appointments.booking_type as bookingFor'
        );

      console.log(`[Reminder] Found ${appointments.length} appointments needing ${hours}h reminder`);

      for (const appt of appointments) {
        // Do not send a 24h reminder for appointments booked less than 24h ahead
        if (hours === 24) {
          const appointmentTime = parseLagosDateTime(appt.date, appt.time);
          const bookedAt = new Date(appt.booked_at);
          if ((appointmentTime.getTime() - bookedAt.getTime()) < 24 * 60 * 60 * 1000) {
            await db('appointments')
              .where('id', appt.id)
              .where(reminderField, false)
              .update({ [reminderField]: true });
            continue;
          }
        }

        try {
          const smsResult = await smsService.sendReminder(appt.phone, appt, hours);
          // A failed SMS must not mark the reminder as sent; never send twice
          if (smsResult && smsResult.success !== false) {
            await db('appointments')
              .where('id', appt.id)
              .where(reminderField, false)
              .update({ [reminderField]: true });
          } else {
            console.error(`[Reminder] Delivery unconfirmed for appointment ${appt.id}`);
          }
        } catch (err) {
          // Failed SMS must not mark the reminder as sent
          console.error(`[Reminder] Failed for appointment ${appt.id}:`, err.message);
        }
      }
    } catch (error) {
      console.error(`[Reminder] Query error for ${hours}h window:`, error.message);
    }
  }
}

module.exports = new ReminderService();
