const app = require('./app');
const config = require('./config');
const reminderService = require('./services/reminder.service');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
  =============================================
   Antenatal & Postnatal Appointment System
  =============================================
   Environment : ${config.nodeEnv}
   Port        : ${PORT}
   API URL     : http://localhost:${PORT}/api
   Health      : http://localhost:${PORT}/api/health
  =============================================
  `);

  // Start the reminder cron job
  if (config.nodeEnv !== 'test') {
    reminderService.start();
  }
});
