/**
 * Clinic & Hospital Information Configuration
 *
 * NOTICE: The values in this file (hospital metadata, days, hours, and contacts)
 * are demonstration placeholders. They must be replaced with the hospital's verified
 * institutional timetable and contact details upon production deployment.
 *
 * Schedular consistency:
 * The days, hours, and slot durations below match exactly what the slot generator
 * (POST /api/admin/slots/generate) and the demo database seeds (02_seed_demo_slots.js)
 * generate:
 * - Antenatal: Monday through Friday, 08:00 - 12:00, 20-minute slots.
 * - Postnatal: Monday through Friday, 13:00 - 16:00, 30-minute slots.
 */
module.exports = {
  // PLACEHOLDER: Full institutional name of the hospital
  hospitalName: 'General Hospital Lagos / Federal Medical Centre',

  // PLACEHOLDER: Physical street address of the hospital
  address: '123 Broad Street, Lagos Island, Lagos State, Nigeria',

  // PLACEHOLDER: Operating days and hours for Antenatal and Postnatal clinic sessions
  clinicDaysAndHours: {
    antenatal: {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      hours: '08:00 - 12:00',
      slotDurationMinutes: 20,
      description: 'Antenatal clinic sessions run Monday through Friday mornings (08:00 - 12:00) with 20-minute consultation slots.',
    },
    postnatal: {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      hours: '13:00 - 16:00',
      slotDurationMinutes: 30,
      description: 'Postnatal clinic sessions run Monday through Friday afternoons (13:00 - 16:00) with 30-minute consultation slots.',
    },
  },

  // PLACEHOLDER: 24/7 direct emergency telephone number for labour / emergency unit
  emergencyUnitNumber: '+2348001122334',

  // PLACEHOLDER: Google Maps pin URL for navigation
  googleMapsUrl: 'https://maps.google.com/?q=General+Hospital+Lagos+Island+Nigeria',
};
