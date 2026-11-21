const LAGOS_TIMEZONE = 'Africa/Lagos';

/**
 * Get current date in Africa/Lagos as 'YYYY-MM-DD'.
 * @param {Date} date
 * @returns {string} Date string in YYYY-MM-DD
 */
function getLagosToday(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LAGOS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Format a Date object as 'YYYY-MM-DD HH:MM:SS' in Africa/Lagos.
 * @param {Date} date
 * @returns {string}
 */
function formatLagosDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LAGOS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/**
 * Parse an appointment date ('YYYY-MM-DD') and time ('HH:MM' or 'HH:MM:SS')
 * in Africa/Lagos (UTC+1, no DST) into a standard Date object.
 * @param {string} slotDate
 * @param {string} startTime
 * @returns {Date}
 */
function parseLagosDateTime(slotDate, startTime) {
  const time = startTime.length === 5 ? `${startTime}:00` : startTime;
  return new Date(`${slotDate}T${time}+01:00`);
}

/**
 * Check if an appointment is still cancellable/reschedulable based on Africa/Lagos cutoff.
 * Returns true if changes are allowed (more than cutoffHours before appointment).
 * @param {string|Date} slotDate
 * @param {string} [startTime]
 * @param {number} [cutoffHours=4]
 * @returns {boolean}
 */
function isWithinCutoffLagos(slotDate, startTime, cutoffHours = 4) {
  const appointmentTime = typeof slotDate === 'string' && typeof startTime === 'string'
    ? parseLagosDateTime(slotDate, startTime)
    : new Date(slotDate);
  const now = new Date();
  const cutoffMs = cutoffHours * 60 * 60 * 1000;
  return (appointmentTime.getTime() - now.getTime()) >= cutoffMs;
}

/**
 * Compute the query window for reminders in Africa/Lagos.
 * Returns { windowStart, windowEnd, startString, endString }.
 * @param {number} hours
 * @param {number} [windowMinutes=15]
 * @returns {{ windowStart: Date, windowEnd: Date, startString: string, endString: string }}
 */
function getReminderWindowLagos(hours, windowMinutes = 15) {
  const now = new Date();
  const targetMs = now.getTime() + hours * 60 * 60 * 1000;
  const windowStart = new Date(targetMs - windowMinutes * 60 * 1000);
  const windowEnd = new Date(targetMs + windowMinutes * 60 * 1000);

  return {
    windowStart,
    windowEnd,
    startString: formatLagosDateTime(windowStart),
    endString: formatLagosDateTime(windowEnd),
  };
}

module.exports = {
  LAGOS_TIMEZONE,
  getLagosToday,
  formatLagosDateTime,
  parseLagosDateTime,
  isWithinCutoffLagos,
  getReminderWindowLagos,
};
