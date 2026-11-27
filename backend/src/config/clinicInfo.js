/**
 * Clinic & Hospital Information Configuration
 *
 * CONFIRMED FROM HOSPITAL INTERVIEW:
 * Hospital identity, physical address, clinic contacts, operating days/hours,
 * and registration/immunisation session notes below are verified institutional details
 * from University Health Services, Bayero University, Kano - Ante-Natal Clinic.
 *
 * Slot length (`slotDurationMinutes`) is NOT hard-coded here; GET /api/clinic-info
 * reads `slot_duration_min` dynamically from the `clinics` database table.
 */
module.exports = {
  // Confirmed from hospital interview
  confirmedFromInterview: true,

  // Confirmed from hospital interview: Full institutional name
  hospitalName: 'University Health Services, Bayero University, Kano - Ante-Natal Clinic',

  // Confirmed from hospital interview: Physical address
  address: 'Inside the main University Health Services Clinic, BUK New Site, Rimin Gata, Gwarzo Road, Kano',

  // Confirmed from hospital interview: Clinic telephone and email contacts
  clinicPhone: '0810 704 7641',
  clinicEmail: 'info.clinic@buk.edu.ng',

  // Confirmed from hospital interview: Operating days and hours (slotDurationMinutes read from clinics table)
  clinicDaysAndHours: {
    antenatal: {
      days: ['Tuesday', 'Thursday'],
      hours: 'About 09:30 to mid-day',
      description: 'Antenatal clinic runs on Tuesday and Thursday, about 09:30 to mid-day.',
    },
    postnatal: {
      days: ['Tuesday', 'Thursday'],
      hours: 'About 09:30 to mid-day',
      description: 'Postnatal clinic runs on Tuesday and Thursday, about 09:30 to mid-day.',
    },
  },

  // Confirmed from hospital interview: Non-covered clinic day schedule notice
  sessionNote: 'Monday is registration day. Wednesday is immunisation, which this system does not cover.',

  // Google Maps search link for the confirmed clinic address
  googleMapsUrl:
    'https://www.google.com/maps/search/?api=1&query=Inside+the+main+University+Health+Services+Clinic%2C+BUK+New+Site%2C+Rimin+Gata%2C+Gwarzo+Road%2C+Kano',
};
