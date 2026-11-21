/**
 * Clinic & Hospital Information Configuration
 * Contains public institutional contact info, schedules, and emergency contacts.
 * Clearly marked placeholders can be customized per hospital deployment.
 */
module.exports = {
  // PLACEHOLDER: Full institutional name of the hospital
  hospitalName: 'General Hospital Lagos / Federal Medical Centre',

  // PLACEHOLDER: Physical street address of the hospital
  address: '123 Broad Street, Lagos Island, Lagos State, Nigeria',

  // PLACEHOLDER: Operating days and hours for Antenatal and Postnatal clinic sessions
  clinicDaysAndHours: {
    antenatal: {
      days: 'Monday through Friday',
      hours: '08:00 AM – 12:00 PM',
      slotDuration: '20 minutes',
    },
    postnatal: {
      days: 'Monday through Friday',
      hours: '01:00 PM – 04:00 PM',
      slotDuration: '30 minutes',
    },
  },

  // PLACEHOLDER: 24/7 direct emergency telephone number for labour / emergency unit
  emergencyUnitNumber: '+2348001122334',

  // PLACEHOLDER: Google Maps pin URL for navigation
  googleMapsUrl: 'https://maps.google.com/?q=General+Hospital+Lagos+Island+Nigeria',
};
