const { v4: uuidv4 } = require('uuid');

/**
 * Generate a queue number for a clinic on a given date.
 * Format: ANC-001 or PNC-001
 * @param {string} clinicPrefix - 'ANC' or 'PNC'
 * @param {number} currentCount - Current number of checked-in patients
 * @returns {string} Queue number
 */
const generateQueueNumber = (clinicPrefix, currentCount) => {
  const num = (currentCount + 1).toString().padStart(3, '0');
  return `${clinicPrefix}-${num}`;
};

/**
 * Format a Nigerian phone number to international format.
 * Accepts 08012345678, +2348012345678, 2348012345678, 8012345678
 * @param {string} phone - Raw phone number
 * @returns {string} Formatted phone number in +234 format
 */
const formatPhone = (phone) => {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('+234')) {
    return cleaned;
  }
  if (cleaned.startsWith('234')) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('0')) {
    return `+234${cleaned.substring(1)}`;
  }
  if (cleaned.length === 10) {
    return `+234${cleaned}`;
  }

  return `+234${cleaned}`;
};

/**
 * Generate a 6-digit OTP code.
 * @returns {string} 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Check if an appointment can still be cancelled/rescheduled
 * based on the cutoff hours.
 * @param {Date} appointmentDate - The appointment date/time
 * @param {number} cutoffHours - Hours before appointment when changes are locked
 * @returns {boolean}
 */
const isWithinCutoff = (appointmentDate, cutoffHours) => {
  const now = new Date();
  const cutoff = new Date(appointmentDate);
  cutoff.setHours(cutoff.getHours() - cutoffHours);
  return now < cutoff;
};

/**
 * Generate a UUID v4.
 * @returns {string}
 */
const generateId = () => uuidv4();

module.exports = {
  generateQueueNumber,
  formatPhone,
  generateOTP,
  isWithinCutoff,
  generateId,
};
