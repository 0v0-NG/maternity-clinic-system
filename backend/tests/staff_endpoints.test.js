const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { v4: uuidv4 } = require('uuid');
const { getLagosToday } = require('../src/utils/helpers');

describe('Staff Endpoints: Appointment Details, Search, Desk Registration, and Baby Management', () => {
  let ancClinicId, pncClinicId;
  let mother1Id, mother2Id, staffFrontDeskId, staffDoctorId, adminId;
  let mother1Token, mother2Token, frontDeskToken, doctorToken, adminToken;
  let slot1Id, walkinSlotTodayId;
  const today = getLagosToday();

  const phoneMother1 = '+2348011111111';
  const phoneMother2 = '+2348022222222';
  const phoneFrontDesk = '+2348033333333';
  const phoneDoctor = '+2348044444444';
  const phoneAdmin = '+2348055555555';

  beforeAll(async () => {
    await db.migrate.latest();

    ancClinicId = uuidv4();
    pncClinicId = uuidv4();

    await db('clinics').insert([
      {
        id: ancClinicId,
        name: 'Antenatal Clinic',
        slot_duration_min: 20,
        walkin_reserve_pct: 0.2,
      },
      {
        id: pncClinicId,
        name: 'Postnatal Clinic',
        slot_duration_min: 30,
        walkin_reserve_pct: 0.2,
      },
    ]);

    mother1Id = uuidv4();
    mother2Id = uuidv4();
    staffFrontDeskId = uuidv4();
    staffDoctorId = uuidv4();
    adminId = uuidv4();

    await db('mothers').insert([
      {
        id: mother1Id,
        phone: phoneMother1,
        name: 'Amina Bello',
        password_hash: 'hash',
        is_verified: true,
        consent_at: new Date(),
        role: 'mother',
        registered_by_staff: false,
      },
      {
        id: mother2Id,
        phone: phoneMother2,
        name: 'Chidinma Okonkwo',
        password_hash: 'hash',
        is_verified: true,
        consent_at: new Date(),
        role: 'mother',
        registered_by_staff: false,
      },
    ]);

    await db('staff').insert([
      {
        id: staffFrontDeskId,
        name: 'Front Desk Officer',
        role: 'front_desk',
        phone: phoneFrontDesk,
        password_hash: 'hash',
      },
      {
        id: staffDoctorId,
        name: 'Dr. Adebayo',
        role: 'doctor',
        phone: phoneDoctor,
        password_hash: 'hash',
      },
      {
        id: adminId,
        name: 'System Admin',
        role: 'admin',
        phone: phoneAdmin,
        password_hash: 'hash',
      },
    ]);

    mother1Token = jwt.sign({ id: mother1Id, phone: phoneMother1, role: 'mother' }, config.jwt.secret, { expiresIn: '1h' });
    mother2Token = jwt.sign({ id: mother2Id, phone: phoneMother2, role: 'mother' }, config.jwt.secret, { expiresIn: '1h' });
    frontDeskToken = jwt.sign({ id: staffFrontDeskId, phone: phoneFrontDesk, role: 'front_desk' }, config.jwt.secret, { expiresIn: '1h' });
    doctorToken = jwt.sign({ id: staffDoctorId, phone: phoneDoctor, role: 'doctor' }, config.jwt.secret, { expiresIn: '1h' });
    adminToken = jwt.sign({ id: adminId, phone: phoneAdmin, role: 'admin' }, config.jwt.secret, { expiresIn: '1h' });

    // Create schedule slots: 1 booked by mother1, 1 walk-in slot on today's date
    slot1Id = uuidv4();
    walkinSlotTodayId = uuidv4();

    await db('schedule_slots').insert([
      {
        id: slot1Id,
        clinic_id: ancClinicId,
        slot_date: today,
        start_time: '10:00:00',
        end_time: '10:20:00',
        is_walkin: false,
      },
      {
        id: walkinSlotTodayId,
        clinic_id: pncClinicId,
        slot_date: today,
        start_time: '23:30:00',
        end_time: '23:59:00',
        is_walkin: true,
      },
    ]);

    // Book appointment for mother1 on slot1
    const apptId = uuidv4();
    await db('appointments').insert({
      id: apptId,
      mother_id: mother1Id,
      slot_id: slot1Id,
      clinic_id: ancClinicId,
      booking_type: 'mother',
      status: 'booked',
      created_at: new Date(),
    });
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('1. Staff appointment list returns mother_name and mother_phone; mother list does not leak', () => {
    it('should include mother_name and mother_phone when called by staff', async () => {
      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const appt = res.body.data.find((a) => a.mother_id === mother1Id);
      expect(appt).toBeDefined();
      expect(appt.mother_name).toBe('Amina Bello');
      expect(appt.mother_phone).toBe(phoneMother1);
      expect(Array.isArray(appt.babies)).toBe(true);
    });

    it('should include mother_name and mother_phone when called by doctor', async () => {
      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.statusCode).toBe(200);
      const appt = res.body.data.find((a) => a.mother_id === mother1Id);
      expect(appt).toBeDefined();
      expect(appt.mother_name).toBe('Amina Bello');
      expect(appt.mother_phone).toBe(phoneMother1);
    });

    it('should NOT leak mother_name or mother_phone on mother self appointment list', async () => {
      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${mother1Token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const appt = res.body.data[0];
      expect(appt.mother_name).toBeUndefined();
      expect(appt.mother_phone).toBeUndefined();
    });
  });

  describe('2. Mother calling GET /api/mothers/search gets 403 FORBIDDEN', () => {
    it('should return 403 FORBIDDEN when mother attempts search', async () => {
      const res = await request(app)
        .get('/api/mothers/search?q=Amina')
        .set('Authorization', `Bearer ${mother1Token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('3. Staff search matches by partial phone and case-insensitive name', () => {
    it('should reject search query shorter than 3 characters with 422 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/mothers/search?q=Am')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      expect(res.statusCode).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should match mother by case-insensitive name substring', async () => {
      const res = await request(app)
        .get('/api/mothers/search?q=amina')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((m) => m.name === 'Amina Bello')).toBe(true);

      const found = res.body.data.find((m) => m.name === 'Amina Bello');
      expect(found.id).toBe(mother1Id);
      expect(found.phone).toBe(phoneMother1);
      expect(found.registered_by_staff).toBe(false);
      expect(Array.isArray(found.babies)).toBe(true);
    });

    it('should match mother by partial phone digits (local or international format)', async () => {
      // phoneMother2 is +2348022222222; searching "080222"
      const res = await request(app)
        .get('/api/mothers/search?q=080222')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.some((m) => m.id === mother2Id)).toBe(true);
    });

    it('should match mother by partial case-insensitive NHIS number (hmo_number) and hospital_id without logging search query', async () => {
      // Seed hospital_id and hmo_number for mother2Id
      await db('mothers').where('id', mother2Id).update({
        hospital_id: 'BUK-FLD-8821',
        hmo_number: 'NHIS-KANO-994',
      });

      const byNhisRes = await request(app)
        .get('/api/mothers/search?q=kano-99')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      expect(byNhisRes.statusCode).toBe(200);
      const matchedNhis = byNhisRes.body.data.find((m) => m.id === mother2Id);
      expect(matchedNhis).toBeDefined();
      expect(matchedNhis.hospital_id).toBe('BUK-FLD-8821');
      expect(matchedNhis.hmo_number).toBe('NHIS-KANO-994');

      const byFolderRes = await request(app)
        .get('/api/mothers/search?q=fld-882')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      expect(byFolderRes.statusCode).toBe(200);
      const matchedFolder = byFolderRes.body.data.find((m) => m.id === mother2Id);
      expect(matchedFolder).toBeDefined();

      // Verify audit log never stores search text
      const auditLogs = await db('audit_logs')
        .where('action', 'STAFF_SEARCH_MOTHERS')
        .orderBy('created_at', 'desc')
        .limit(5);
      auditLogs.forEach((log) => {
        expect(log.details).not.toContain('kano-99');
        expect(log.details).not.toContain('fld-882');
      });
    });

    it('should return empty list when no match is found', async () => {
      const res = await request(app)
        .get('/api/mothers/search?q=NonexistentPerson')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should respect the 20-result limit', async () => {
      // Seed 25 mothers matching a common prefix
      const bulkMothers = [];
      for (let i = 0; i < 25; i++) {
        bulkMothers.push({
          id: uuidv4(),
          phone: `+23489999999${String(i).padStart(2, '0')}`,
          name: `BatchTest Patient ${i}`,
          password_hash: 'hash',
          is_verified: true,
          consent_at: new Date(),
          role: 'mother',
          registered_by_staff: true,
        });
      }
      await db('mothers').insert(bulkMothers);

      const res = await request(app)
        .get('/api/mothers/search?q=BatchTest')
        .set('Authorization', `Bearer ${frontDeskToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.length).toBe(20);
    });
  });

  describe('4. Desk registration rules (consent, duplicate phone, registered_by_staff)', () => {
    const uniquePhone = `+23481${Math.floor(10000000 + Math.random() * 90000000)}`;

    it('should reject registration when consent_confirmed is missing or false with 400 CONSENT_REQUIRED', async () => {
      const res = await request(app)
        .post('/api/mothers')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          name: 'Blessing Okon',
          phone: uniquePhone,
          consent_confirmed: false,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('CONSENT_REQUIRED');
      expect(res.body.error.message).toContain('consent');
    });

    it('should reject registration if phone is already registered with 409 CONFLICT', async () => {
      const res = await request(app)
        .post('/api/mothers')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          name: 'Duplicate Patient',
          phone: phoneMother1, // already registered
          consent_confirmed: true,
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toBe('A patient with this phone number is already registered. Please search for her instead.');
    });

    it('should successfully register a mother with registered_by_staff = true and return 201', async () => {
      const res = await request(app)
        .post('/api/mothers')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          name: 'Blessing Okon',
          phone: uniquePhone,
          hospital_id: 'HOSP-1234',
          hmo_number: 'HMO-5678',
          consent_confirmed: true,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Blessing Okon');
      expect(res.body.data.phone).toBe(uniquePhone);
      expect(res.body.data.hospital_id).toBe('HOSP-1234');
      expect(res.body.data.hmo_number).toBe('HMO-5678');
      expect(res.body.data.registered_by_staff).toBe(true);
      expect(res.body.data.created_at).toBeDefined();

      // Check DB directly
      const motherInDb = await db('mothers').where('id', res.body.data.id).first();
      expect(motherInDb).toBeDefined();
      expect(motherInDb.is_verified).toBeTruthy();
      expect(Boolean(motherInDb.registered_by_staff)).toBe(true);
    });
  });

  describe('5. Desk-registered patient cannot log in (401 INVALID_CREDENTIALS)', () => {
    it('should return 401 INVALID_CREDENTIALS when desk-registered mother attempts login', async () => {
      const deskPhone = `+23487${Math.floor(10000000 + Math.random() * 90000000)}`;
      await request(app)
        .post('/api/mothers')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          name: 'Desk Mother',
          phone: deskPhone,
          consent_confirmed: true,
        });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          phone: deskPhone,
          password: 'AnyPassword123!',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('6. Staff can add a baby for a mother; mother cannot add a baby for a different mother', () => {
    it('should allow staff to add a baby for a mother by sending mother_id', async () => {
      const res = await request(app)
        .post('/api/babies')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          name: 'Baby Amina',
          date_of_birth: '2026-06-01',
          sex: 'female',
          mother_id: mother1Id,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.name).toBe('Baby Amina');
      expect(res.body.data.mother_id).toBe(mother1Id);
    });

    it('should ignore mother_id when called by mother and use caller ID instead', async () => {
      // mother1 attempts to specify mother2Id
      const res = await request(app)
        .post('/api/babies')
        .set('Authorization', `Bearer ${mother1Token}`)
        .send({
          name: 'Baby Sneaky',
          date_of_birth: '2026-07-01',
          sex: 'male',
          mother_id: mother2Id,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.mother_id).toBe(mother1Id); // Must be mother1, NOT mother2!
    });
  });

  describe('7. Full desk-registration flow from patient creation to walk-in booking and check-in', () => {
    it('should complete registration, baby creation, walk-in booking, and check-in', async () => {
      const flowPhone = `+23485${Math.floor(10000000 + Math.random() * 90000000)}`;

      // Step 1: Register mother at desk
      const regRes = await request(app)
        .post('/api/mothers')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          name: 'Zainab Ahmed',
          phone: flowPhone,
          hospital_id: 'HOSP-ZAINAB-1',
          hmo_number: 'HMO-ZAINAB-1',
          consent_confirmed: true,
        });

      expect(regRes.statusCode).toBe(201);
      const newMotherId = regRes.body.data.id;

      // Step 2: Add baby for Zainab
      const babyRes = await request(app)
        .post('/api/babies')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          mother_id: newMotherId,
          name: 'Baby Zainab',
          date_of_birth: '2026-08-01',
          sex: 'female',
        });

      expect(babyRes.statusCode).toBe(201);
      const babyId = babyRes.body.data.id;

      // Step 3: Book walk-in slot for Postnatal clinic for baby
      const bookRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${frontDeskToken}`)
        .send({
          slot_id: walkinSlotTodayId,
          clinic_id: pncClinicId,
          mother_id: newMotherId,
          booking_type: 'baby',
          baby_ids: [babyId],
        });

      expect(bookRes.statusCode).toBe(201);
      const apptId = bookRes.body.data.id;
      expect(bookRes.body.data.mother_id).toBe(newMotherId);

      // Step 4: Check-in on same day
      const checkinRes = await request(app)
        .post(`/api/appointments/${apptId}/checkin`)
        .set('Authorization', `Bearer ${frontDeskToken}`);

      expect(checkinRes.statusCode).toBe(200);
      expect(checkinRes.body.data.status).toBe('checked_in');
      expect(checkinRes.body.data.queueNumber).toBeDefined();
    });
  });

  describe('8. GET /api/mothers/:id returns past & upcoming visits newest first without clinical data', () => {
    it('should deny mothers (403) and return ordered non-clinical visits with baby names + audit log for staff', async () => {
      const forbiddenRes = await request(app)
        .get(`/api/mothers/${mother1Id}`)
        .set('Authorization', `Bearer ${mother1Token}`);
      expect(forbiddenRes.statusCode).toBe(403);

      // Seed an older completed appointment + a newer booked appointment for mother1Id
      const olderSlotId = uuidv4();
      const newerSlotId = uuidv4();
      await db('schedule_slots').insert([
        {
          id: olderSlotId,
          clinic_id: pncClinicId,
          slot_date: '2026-10-01',
          start_time: '09:30:00',
          end_time: '10:00:00',
          is_walkin: false,
          is_blocked: false,
        },
        {
          id: newerSlotId,
          clinic_id: pncClinicId,
          slot_date: '2026-12-30',
          start_time: '10:00:00',
          end_time: '10:30:00',
          is_walkin: false,
          is_blocked: false,
        },
      ]);

      const visitBabyId = uuidv4();
      await db('babies').insert({
        id: visitBabyId,
        mother_id: mother1Id,
        name: 'Baby Sadiq',
        date_of_birth: '2026-05-01',
        sex: 'male',
      });

      const olderApptId = uuidv4();
      const newerApptId = uuidv4();
      await db('appointments').insert([
        {
          id: olderApptId,
          mother_id: mother1Id,
          clinic_id: pncClinicId,
          slot_id: olderSlotId,
          status: 'completed',
          booking_type: 'baby',
          booked_at: new Date(),
        },
        {
          id: newerApptId,
          mother_id: mother1Id,
          clinic_id: pncClinicId,
          slot_id: newerSlotId,
          status: 'booked',
          booking_type: 'both',
          booked_at: new Date(),
        },
      ]);

      await db('appointment_babies').insert([
        { appointment_id: olderApptId, baby_id: visitBabyId },
        { appointment_id: newerApptId, baby_id: visitBabyId },
      ]);

      const res = await request(app)
        .get(`/api/mothers/${mother1Id}`)
        .set('Authorization', `Bearer ${frontDeskToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.visits)).toBe(true);
      expect(res.body.data.visits.length).toBeGreaterThanOrEqual(2);

      // Verify newest first ordering
      const idxNew = res.body.data.visits.findIndex((v) => v.id === newerApptId);
      const idxOld = res.body.data.visits.findIndex((v) => v.id === olderApptId);
      expect(idxNew).toBeGreaterThanOrEqual(0);
      expect(idxOld).toBeGreaterThan(idxNew);

      const newerVisit = res.body.data.visits[idxNew];
      expect(newerVisit.date).toBe('2026-12-30');
      expect(newerVisit.start_time).toBe('10:00:00');
      expect(newerVisit.clinic_name).toBe('Postnatal Clinic');
      expect(newerVisit.status).toBe('booked');
      expect(newerVisit.babies.map((b) => b.name)).toContain('Baby Sadiq');
      // Verify no clinical notes/vitals fields exist
      expect(newerVisit.notes).toBeUndefined();
      expect(newerVisit.diagnosis).toBeUndefined();

      // Verify audit log written
      const log = await db('audit_logs')
        .where({ action: 'STAFF_VIEW_MOTHER_PROFILE' })
        .orderBy('created_at', 'desc')
        .first();
      expect(log).toBeDefined();
    });
  });
});
