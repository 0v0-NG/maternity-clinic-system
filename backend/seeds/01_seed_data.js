const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * Seed data for development and testing.
 */
exports.seed = async function (knex) {
  // Clear existing data (in reverse dependency order)
  await knex('audit_logs').del();
  await knex('appointment_babies').del();
  await knex('appointments').del();
  await knex('schedule_slots').del();
  await knex('clinic_staff').del();
  await knex('clinics').del();
  await knex('babies').del();
  await knex('staff').del();
  await knex('mothers').del();

  const passwordHash = await bcrypt.hash('password123', 12);

  // --- Clinics ---
  const ancClinicId = uuidv4();
  const pncClinicId = uuidv4();

  await knex('clinics').insert([
    { id: ancClinicId, name: 'Antenatal Clinic', slot_duration_min: 20, walkin_reserve_pct: 0.2 },
    { id: pncClinicId, name: 'Postnatal Clinic', slot_duration_min: 30, walkin_reserve_pct: 0.2 },
  ]);

  // --- Staff ---
  const adminId = uuidv4();
  const doctorId = uuidv4();
  const midwifeId = uuidv4();
  const frontDeskId = uuidv4();

  await knex('staff').insert([
    { id: adminId, name: 'Admin User', role: 'admin', phone: '+2340000000001', password_hash: passwordHash },
    { id: doctorId, name: 'Dr. Adebayo', role: 'doctor', phone: '+2340000000002', password_hash: passwordHash },
    { id: midwifeId, name: 'Nurse Fatima', role: 'midwife', phone: '+2340000000003', password_hash: passwordHash },
    { id: frontDeskId, name: 'Mr. Chukwu', role: 'front_desk', phone: '+2340000000004', password_hash: passwordHash },
  ]);

  // --- Clinic ↔ Staff ---
  await knex('clinic_staff').insert([
    { clinic_id: ancClinicId, staff_id: doctorId },
    { clinic_id: ancClinicId, staff_id: midwifeId },
    { clinic_id: pncClinicId, staff_id: doctorId },
    { clinic_id: pncClinicId, staff_id: midwifeId },
  ]);

  // --- Sample Slots (next 5 weekdays) ---
  const slots = [];
  const today = new Date();

  for (let d = 0; d < 7; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends

    const dateStr = date.toISOString().split('T')[0];

    // ANC slots: 08:00–12:00, 20-min each = 12 slots
    for (let i = 0; i < 12; i++) {
      const startHour = 8 + Math.floor((i * 20) / 60);
      const startMin = (i * 20) % 60;
      const endMin = startMin + 20;
      const endHour = startHour + Math.floor(endMin / 60);

      slots.push({
        id: uuidv4(),
        clinic_id: ancClinicId,
        staff_id: i % 2 === 0 ? doctorId : midwifeId,
        slot_date: dateStr,
        start_time: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
        end_time: `${String(endHour).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
        is_walkin: i >= 10, // last 2 slots reserved for walk-ins
        is_blocked: false,
      });
    }

    // PNC slots: 13:00–16:00, 30-min each = 6 slots
    for (let i = 0; i < 6; i++) {
      const startHour = 13 + Math.floor((i * 30) / 60);
      const startMin = (i * 30) % 60;
      const endMin = startMin + 30;
      const endHour = startHour + Math.floor(endMin / 60);

      slots.push({
        id: uuidv4(),
        clinic_id: pncClinicId,
        staff_id: i % 2 === 0 ? doctorId : midwifeId,
        slot_date: dateStr,
        start_time: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
        end_time: `${String(endHour).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
        is_walkin: i >= 5,
        is_blocked: false,
      });
    }
  }

  await knex('schedule_slots').insert(slots);

  // --- Sample Mother ---
  const motherId = uuidv4();
  await knex('mothers').insert({
    id: motherId,
    phone: '+2348012345678',
    name: 'Mrs. Amina Bello',
    password_hash: passwordHash,
    hospital_id: 'HOSP-00123',
    hmo_number: 'HMO-456',
    is_verified: true,
    role: 'mother',
  });

  // --- Sample Baby ---
  await knex('babies').insert({
    id: uuidv4(),
    mother_id: motherId,
    name: 'Baby Bello',
    date_of_birth: '2024-11-01',
    sex: 'female',
  });

  console.log('Seed data inserted successfully.');
};
