const { v4: uuidv4 } = require('uuid');
const db = require('../src/config/database');
const reminderService = require('../src/services/reminder.service');
const { formatLagosDateTime, getLagosToday } = require('../src/utils/helpers');

async function proveReminders() {
  console.log('--- A3: Proving Reminder Worker on Neon PostgreSQL ---\n');

  const createdSlotIds = [];
  const createdApptIds = [];
  const createdMotherIds = [];
  let proofSuccess = false;

  try {
    const clinic = await db('clinics').where('name', 'Antenatal Clinic').first();
    if (!clinic) throw new Error('Antenatal Clinic not found.');

    const now = new Date();
    // Exactly 2 hours ahead in Lagos
    const date2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    // Exactly 24 hours ahead in Lagos
    const date24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const slot2hDateStr = getLagosToday(date2h);
    const slot2hTimeStr = formatLagosDateTime(date2h).split(' ')[1];

    const slot24hDateStr = getLagosToday(date24h);
    const slot24hTimeStr = formatLagosDateTime(date24h).split(' ')[1];

    console.log(`Creating test slot ~2h ahead: ${slot2hDateStr} ${slot2hTimeStr}`);
    console.log(`Creating test slot ~24h ahead: ${slot24hDateStr} ${slot24hTimeStr}`);

    // Create test mother
    const motherId = uuidv4();
    createdMotherIds.push(motherId);
    await db('mothers').insert({
      id: motherId,
      phone: `+23470${Math.floor(10000000 + Math.random() * 90000000)}`,
      name: 'Reminder Proof Mother',
      password_hash: 'hash',
      is_verified: true,
      consent_at: new Date(),
      role: 'mother',
    });

    // Create slots
    const slot2hId = uuidv4();
    const slot24hId = uuidv4();
    createdSlotIds.push(slot2hId, slot24hId);

    await db('schedule_slots').insert([
      {
        id: slot2hId,
        clinic_id: clinic.id,
        slot_date: slot2hDateStr,
        start_time: slot2hTimeStr,
        end_time: '23:59:00',
        is_walkin: false,
        is_blocked: false,
      },
      {
        id: slot24hId,
        clinic_id: clinic.id,
        slot_date: slot24hDateStr,
        start_time: slot24hTimeStr,
        end_time: '23:59:00',
        is_walkin: false,
        is_blocked: false,
      },
    ]);

    // Create appointments
    const appt2hId = uuidv4();
    const appt24hId = uuidv4();
    createdApptIds.push(appt2hId, appt24hId);

    await db('appointments').insert([
      {
        id: appt2hId,
        mother_id: motherId,
        clinic_id: clinic.id,
        slot_id: slot2hId,
        status: 'booked',
        booking_type: 'mother',
        booked_at: new Date(now.getTime() - 2 * 3600 * 1000), // booked 2h ago
        reminder_2h_sent: false,
        reminder_24h_sent: false,
      },
      {
        id: appt24hId,
        mother_id: motherId,
        clinic_id: clinic.id,
        slot_id: slot24hId,
        status: 'booked',
        booking_type: 'mother',
        booked_at: new Date(now.getTime() - 48 * 3600 * 1000), // booked 48h ago (>= 24h ahead of appointment)
        reminder_2h_sent: false,
        reminder_24h_sent: false,
      },
    ]);

    console.log(`\nInitial status before worker run:`);
    console.log(`- Appointment ~2h  (${appt2hId}) : reminder_2h_sent = false`);
    console.log(`- Appointment ~24h (${appt24hId}): reminder_24h_sent = false`);

    console.log(`\nTriggering reminderService.processReminders() on Neon PostgreSQL...`);
    await reminderService.processReminders();

    // Query DB to inspect results
    const appt2hAfter = await db('appointments').where('id', appt2hId).first();
    const appt24hAfter = await db('appointments').where('id', appt24hId).first();

    console.log(`\nStatus after worker run:`);
    console.log(`- Appointment ~2h  (${appt2hId}) : reminder_2h_sent = ${appt2hAfter.reminder_2h_sent}`);
    console.log(`- Appointment ~24h (${appt24hId}): reminder_24h_sent = ${appt24hAfter.reminder_24h_sent}`);

    proofSuccess = appt2hAfter.reminder_2h_sent === true && appt24hAfter.reminder_24h_sent === true;
    console.log(`\nReminder Proof Result: ${proofSuccess ? 'PASS' : 'FAIL'}`);

  } catch (error) {
    console.error('Error during reminder proof:', error.message);
  } finally {
    console.log('\nCleaning up test reminder data from Neon...');
    if (createdApptIds.length) {
      await db('appointments').whereIn('id', createdApptIds).del();
    }
    if (createdSlotIds.length) {
      await db('schedule_slots').whereIn('id', createdSlotIds).del();
    }
    if (createdMotherIds.length) {
      await db('audit_logs').whereIn('user_id', createdMotherIds).del();
      await db('mothers').whereIn('id', createdMotherIds).del();
    }
    console.log('Cleanup complete. Seed data remains untouched.');
    await db.destroy();
    process.exit(proofSuccess ? 0 : 1);
  }
}

proveReminders();
