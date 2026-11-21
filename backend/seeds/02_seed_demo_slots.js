const { v4: uuidv4 } = require('uuid');

/**
 * Demo Seed: Regenerates schedule slots for today and the next 4 days (including weekends)
 * for both Antenatal and Postnatal clinics, without deleting mothers, staff, babies,
 * or existing appointments.
 */
exports.seed = async function (knex) {
  // 1. Retrieve existing clinics
  const ancClinic = await knex('clinics')
    .whereRaw('LOWER(name) LIKE ?', ['%antenatal%'])
    .first();
  const pncClinic = await knex('clinics')
    .whereRaw('LOWER(name) LIKE ?', ['%postnatal%'])
    .first();

  if (!ancClinic || !pncClinic) {
    throw new Error('Clinics not found. Run main seed (npm run seed) first.');
  }

  // 2. Retrieve existing clinical staff (doctors and midwives)
  const doctors = await knex('staff').where('role', 'doctor').select('id');
  const midwives = await knex('staff').where('role', 'midwife').select('id');

  const doctorId = doctors.length > 0 ? doctors[0].id : null;
  const midwifeId = midwives.length > 0 ? midwives[0].id : doctorId;

  // 3. Compute target dates: today and the next 4 days (5 days total, including weekends)
  const today = new Date();
  const targetDates = [];

  for (let d = 0; d < 5; d++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + d);
    targetDates.push(targetDate.toISOString().split('T')[0]);
  }

  // 4. Find all slot IDs currently referenced by existing appointments to protect them
  const bookedAppointments = await knex('appointments').select('slot_id');
  const bookedSlotIds = bookedAppointments
    .map((a) => a.slot_id)
    .filter((id) => Boolean(id));

  // 5. Remove only UNBOOKED slots for the target dates so we can cleanly regenerate
  await knex('schedule_slots')
    .whereIn('slot_date', targetDates)
    .whereNotIn('id', bookedSlotIds)
    .del();

  // Find any existing slots that were kept (because they have appointments)
  const keptSlots = await knex('schedule_slots')
    .whereIn('slot_date', targetDates)
    .select('clinic_id', 'slot_date', 'start_time');

  const keptKeySet = new Set(
    keptSlots.map((s) => `${s.clinic_id}_${s.slot_date}_${s.start_time}`)
  );

  // 6. Generate new slots for both clinics across all 5 days (including weekends)
  const newSlots = [];

  for (const dateStr of targetDates) {
    // --- Antenatal Clinic (ANC): 08:00 - 12:00, 20-min intervals = 12 slots ---
    for (let i = 0; i < 12; i++) {
      const startHour = 8 + Math.floor((i * 20) / 60);
      const startMin = (i * 20) % 60;
      const endMin = startMin + 20;
      const endHour = startHour + Math.floor(endMin / 60);

      const startTimeStr = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
      const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

      // Skip if a booked slot already exists at this exact time
      const key = `${ancClinic.id}_${dateStr}_${startTimeStr}`;
      if (keptKeySet.has(key)) continue;

      newSlots.push({
        id: uuidv4(),
        clinic_id: ancClinic.id,
        staff_id: i % 2 === 0 ? doctorId : midwifeId,
        slot_date: dateStr,
        start_time: startTimeStr,
        end_time: endTimeStr,
        is_walkin: i >= 10, // ~20% reserved for walk-ins (2 out of 12)
        is_blocked: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // --- Postnatal Clinic (PNC): 13:00 - 16:00, 30-min intervals = 6 slots ---
    for (let i = 0; i < 6; i++) {
      const startHour = 13 + Math.floor((i * 30) / 60);
      const startMin = (i * 30) % 60;
      const endMin = startMin + 30;
      const endHour = startHour + Math.floor(endMin / 60);

      const startTimeStr = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
      const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

      // Skip if a booked slot already exists at this exact time
      const key = `${pncClinic.id}_${dateStr}_${startTimeStr}`;
      if (keptKeySet.has(key)) continue;

      newSlots.push({
        id: uuidv4(),
        clinic_id: pncClinic.id,
        staff_id: i % 2 === 0 ? doctorId : midwifeId,
        slot_date: dateStr,
        start_time: startTimeStr,
        end_time: endTimeStr,
        is_walkin: i >= 5, // ~20% reserved for walk-ins (1 out of 6)
        is_blocked: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }

  if (newSlots.length > 0) {
    await knex('schedule_slots').insert(newSlots);
  }

  console.log(`[seed:demo] Successfully regenerated slots for dates: ${targetDates.join(', ')}`);
  console.log(`[seed:demo] Total newly inserted slots: ${newSlots.length}`);
};
