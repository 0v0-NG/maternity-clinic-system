// Date and time formatting utilities in Africa/Lagos timezone (UTC+1).

/**
 * Format a date string (e.g. '2026-11-22' or ISO string) to DD/MM/YYYY in Africa/Lagos.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Format a time string (e.g. '08:20:00' or ISO timestamp) to 12-hour format with AM/PM in Africa/Lagos.
 */
export function formatTime12(timeStr) {
  if (!timeStr) return '';
  if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr.padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${m} ${ampm}`;
  }
  const date = new Date(timeStr);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Format start and end time range (e.g. '8:20 AM – 8:40 AM').
 */
export function formatTimeRange(startTime, endTime) {
  if (!startTime) return '';
  const start = formatTime12(startTime);
  if (!endTime) return start;
  const end = formatTime12(endTime);
  return `${start} – ${end}`;
}

/**
 * Format an ISO timestamp to 'DD/MM/YYYY, h:mm AM/PM' in Africa/Lagos.
 */
export function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return '';
  const dateFormatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  const timeFormatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${dateFormatted}, ${timeFormatted}`;
}

/**
 * Get current date in Africa/Lagos as 'YYYY-MM-DD'.
 */
export function getLagosToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Get a date N days before today in Africa/Lagos as 'YYYY-MM-DD'.
 */
export function getLagosDaysAgo(days = 7) {
  const todayStr = getLagosToday();
  const [y, m, d] = todayStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - days));
  return dt.toISOString().split('T')[0];
}

/**
 * Generate the next `count` dates (default 14) starting from today in Africa/Lagos.
 * Returns array of { date: 'YYYY-MM-DD', weekday: 'Mon', dayMonth: '22 Nov', isToday: boolean }.
 */
export function getNextDays(count = 14) {
  const todayStr = getLagosToday();
  const [y, m, d] = todayStr.split('-').map(Number);
  const days = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const isoDate = dt.toISOString().split('T')[0];
    const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', weekday: 'short' }).format(dt);
    const dayMonth = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short' }).format(dt);
    days.push({
      date: isoDate,
      weekday,
      dayMonth,
      isToday: i === 0,
    });
  }
  return days;
}

/**
 * Friendly label for who the appointment is for.
 */
export function formatWhoFor(bookingType, babies = []) {
  const babyNames = (babies || []).map((b) => (typeof b === 'object' ? b.name : b)).filter(Boolean);
  const babyLabel = babyNames.length > 0 ? `Baby (${babyNames.join(', ')})` : 'Baby';

  switch (bookingType) {
    case 'baby':
      return babyLabel;
    case 'both':
      return babyNames.length > 0 ? `Mother & Baby (${babyNames.join(', ')})` : 'Mother & Baby';
    case 'mother':
    default:
      return 'Mother';
  }
}
