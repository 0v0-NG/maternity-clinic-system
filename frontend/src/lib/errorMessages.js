// Maps every backend error.code in API_CONTRACT.md to a friendly Plain English message.
// Always branch on error.code, never on message text.
export const errorMessages = {
  VALIDATION_ERROR: 'Please check your entry and try again.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to do this.',
  NOT_FOUND: 'The item you are looking for could not be found.',
  SLOT_TAKEN: 'Another patient just took this slot. Please choose another time.',
  OVERLAP: 'You already have an appointment at this time.',
  BOOKING_TYPE_INVALID: 'This booking type is not allowed for the clinic you chose.',
  SLOT_RESERVED: 'This slot is reserved for hospital walk-in patients. Please choose another.',
  SLOT_PAST: 'This time slot has already passed.',
  CUTOFF_PASSED: 'Appointments cannot be cancelled or rescheduled within 4 hours of the start time. Please contact the front desk.',
  CHECKIN_NOT_ALLOWED: 'Check-in is only allowed on the day of your appointment, for an active booking.',
  NO_SHOW_TOO_EARLY: 'You cannot mark this as a no-show yet. Please wait until after your appointment time.',
  OTP_INVALID: 'The code you entered is incorrect or has expired. Please try again.',
  BAD_REQUEST: 'Something went wrong. Please try again.',
  INTERNAL_SERVER_ERROR: 'Our service is having trouble. Please try again later.',
};

// Extract the backend error.code from an axios error response.
// Contract error shape: { success: false, error: { code, message }, message }
export function getErrorCode(error) {
  if (!error || !error.response) return null;
  const data = error.response.data;
  if (data && data.error && data.error.code) return data.error.code;
  if (data && data.error) return data.error; // sometimes the code is sent directly
  if (data && data.code) return data.code;
  return null;
}

// Return a friendly message for an error, falling back to a generic one.
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const code = getErrorCode(error);
  if (code && errorMessages[code]) {
    return errorMessages[code];
  }
  return fallback;
}
