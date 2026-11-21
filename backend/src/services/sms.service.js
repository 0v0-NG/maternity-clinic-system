const config = require('../config');

/**
 * Termii SMS Gateway Service
 * Handles OTP sending/verification and general SMS delivery.
 */
class SMSService {
  constructor() {
    this.apiKey = config.sms.apiKey;
    this.senderId = config.sms.senderId;
    this.baseUrl = config.sms.baseUrl;
  }

  /**
   * Send a general SMS message.
   * @param {string} phone - Recipient phone number
   * @param {string} message - Message content
   * @returns {Promise<object>} Termii API response
   */
  async sendSMS(phone, message) {
    if (!this.apiKey || this.apiKey === 'demo' || this.apiKey === 'your_termii_api_key') {
      console.log(`\n========================================`);
      console.log(`📱 [SMS SIMULATION] To: ${phone}`);
      console.log(`💬 Message: ${message}`);
      console.log(`========================================\n`);
      return { success: true, message: 'Simulated SMS delivered', message_id: 'demo-' + Date.now() };
    }

    try {
      const response = await fetch(`${this.baseUrl}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          from: this.senderId,
          sms: message,
          type: 'plain',
          channel: 'generic',
          api_key: this.apiKey,
        }),
      });

      const data = await response.json();
      if (!response.ok || (data.code && data.code !== 'ok' && !data.message_id)) {
        throw new Error(data.message || 'SMS delivery failed');
      }
      console.log(`[SMS] Sent to ${phone}: ${message.substring(0, 50)}...`);
      return data;
    } catch (error) {
      console.error(`[SMS] Failed to send to ${phone}:`, error.message);
      throw error;
    }
  }

  /**
   * Send an OTP to a phone number.
   * @param {string} phone - Recipient phone number
   * @returns {Promise<object>} Contains pinId for verification
   */
  async sendOTP(phone) {
    if (!this.apiKey || this.apiKey === 'demo' || this.apiKey === 'your_termii_api_key') {
      const demoOtp = '123456';
      const pinId = 'demo-pin-' + Date.now();
      console.log(`\n========================================`);
      console.log(`🔐 [OTP SIMULATION] To: ${phone}`);
      console.log(`🔢 Code: ${demoOtp} (valid for testing)`);
      console.log(`========================================\n`);
      return { pinId, otp: demoOtp, verified: false, message: 'Demo OTP generated' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/sms/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          message_type: 'NUMERIC',
          to: phone,
          from: this.senderId,
          channel: 'generic',
          pin_attempts: 3,
          pin_time_to_live: 10,
          pin_length: 6,
          pin_placeholder: '< 1234 >',
          message_text: 'Your ANC/PNC clinic verification code is < 1234 >. Valid for 10 minutes.',
        }),
      });

      const data = await response.json();
      console.log(`[SMS] OTP sent to ${phone}`);
      return data;
    } catch (error) {
      console.error(`[SMS] OTP send failed for ${phone}:`, error.message);
      throw error;
    }
  }

  /**
   * Verify an OTP.
   * @param {string} pinId - Pin ID from sendOTP response
   * @param {string} otp - User-entered OTP
   * @returns {Promise<object>} Verification result
   */
  async verifyOTP(pinId, otp) {
    if (!this.apiKey || this.apiKey === 'demo' || this.apiKey === 'your_termii_api_key' || (pinId && pinId.startsWith('demo-pin-'))) {
      if (otp === '123456' || otp.length === 6) {
        console.log(`✅ [OTP VERIFIED] Code ${otp} accepted in Demo Mode.`);
        return { verified: true };
      }
      return { verified: false };
    }

    try {
      const response = await fetch(`${this.baseUrl}/sms/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          pin_id: pinId,
          pin: otp,
        }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`[SMS] OTP verify failed:`, error.message);
      throw error;
    }
  }

  /**
   * Send appointment confirmation SMS.
   * @param {string} phone
   * @param {object} appointment - Appointment details
   */
  async sendBookingConfirmation(phone, appointment) {
    const msg = `Appointment confirmed!\nClinic: ${appointment.clinicName}\nDate: ${appointment.date}\nTime: ${appointment.time}\nFor: ${appointment.bookingFor}\n\nTo reschedule or cancel, visit your dashboard.`;
    return this.sendSMS(phone, msg);
  }

  /**
   * Send appointment reminder SMS.
   * @param {string} phone
   * @param {object} appointment
   * @param {number} hoursUntil - Hours until appointment
   */
  async sendReminder(phone, appointment, hoursUntil) {
    const msg = `Reminder: You have a ${appointment.clinicName} appointment in ${hoursUntil} hour(s).\nDate: ${appointment.date}\nTime: ${appointment.time}\nPlease arrive 15 minutes early.`;
    return this.sendSMS(phone, msg);
  }

  /**
   * Send bulk cancellation notice when a clinic session is cancelled.
   * @param {Array<{phone: string, appointment: object}>} recipients
   * @param {string} reason
   */
  async sendBulkCancellation(recipients, reason) {
    const results = [];
    for (const { phone, appointment } of recipients) {
      const msg = `Your ${appointment.clinicName} appointment on ${appointment.date} at ${appointment.time} has been cancelled.\nReason: ${reason}\nPlease rebook at your earliest convenience.`;
      try {
        const result = await this.sendSMS(phone, msg);
        results.push({ phone, success: true, result });
      } catch (error) {
        results.push({ phone, success: false, error: error.message });
      }
    }
    return results;
  }
}

module.exports = new SMSService();
