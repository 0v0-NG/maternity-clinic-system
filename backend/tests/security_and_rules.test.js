const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { v4: uuidv4 } = require('uuid');
const { getLagosToday } = require('../src/utils/helpers');

describe('Security, Walk-in Rules, and Audit Logging', () => {
  let clinicId, pncClinicId, mother1Id, mother2Id, staffId, doctorId, adminId;
  let mother1Token, mother2Token, staffToken, doctorToken, adminToken;
  let regularSlotId, walkinSlotId, appt1Id, baby1Id, otherMotherBabyId;
  const todayDate = getLagosToday();
  const phone1 = `+23480${Math.floor(10000000 + Math.random() * 90000000)}`;
  const phone2 = `+23480${Math.floor(10000000 + Math.random() * 90000000)}`;
  const phone3 = `+23480${Math.floor(10000000 + Math.random() * 90000000)}`;
  const phone4 = `+23480${Math.floor(10000000 + Math.random() * 90000000)}`;
  const phone5 = `+23480${Math.floor(10000000 + Math.random() * 90000000)}`;

  beforeAll(async () => {
    await db.migrate.latest();

    clinicId = uuidv4();
    pncClinicId = uuidv4();

    await db('clinics').insert([
      {
        id: clinicId,
        name: 'ANC Test Clinic',
        slot_duration_min: 20,
        walkin_reserve_pct: 0.2,
      },
      {
        id: pncClinicId,
        name: 'Postnatal Test Clinic',
        slot_duration_min: 30,
        walkin_reserve_pct: 0.2,
      },
    ]);

    mother1Id = uuidv4();
    mother2Id = uuidv4();
    staffId = uuidv4();
    doctorId = uuidv4();
    adminId = uuidv4();

    await db('mothers').insert([
      { id: mother1Id, phone: phone1, name: 'Mother One', password_hash: 'hash', is_verified: true, consent_at: new Date(), role: 'mother' },
      { id: mother2Id, phone: phone2, name: 'Mother Two', password_hash: 'hash', is_verified: true, consent_at: new Date(), role: 'mother' },
    ]);

    await db('staff').insert([
      {
        id: staffId,
        name: 'Front Desk Officer',
        role: 'front_desk',
        phone: phone3,
        password_hash: 'hash',
      },
      {
        id: doctorId,
        name: 'Doctor Test Specialist',
        role: 'doctor',
        phone: phone4,
        password_hash: 'hash',
      },
      {
        id: adminId,
        name: 'Admin Test Officer',
        role: 'admin',
        phone: phone5,
        password_hash: 'hash',
      },
    ]);

    baby1Id = uuidv4();
    otherMotherBabyId = uuidv4();
    await db('babies').insert([
      { id: baby1Id, mother_id: mother1Id, name: 'Baby One', date_of_birth: '2026-01-01', sex: 'female' },
      { id: otherMotherBabyId, mother_id: mother2Id, name: 'Other Baby', date_of_birth: '2026-02-01', sex: 'male' },
    ]);

    mother1Token = jwt.sign({ id: mother1Id, role: 'mother', name: 'Mother One' }, config.jwt.secret);
    mother2Token = jwt.sign({ id: mother2Id, role: 'mother', name: 'Mother Two' }, config.jwt.secret);
    staffToken = jwt.sign({ id: staffId, role: 'front_desk', name: 'Front Desk Officer' }, config.jwt.secret);
    doctorToken = jwt.sign({ id: doctorId, role: 'doctor', name: 'Doctor Test Specialist' }, config.jwt.secret);
    adminToken = jwt.sign({ id: adminId, role: 'admin', name: 'Admin Test Officer' }, config.jwt.secret);

    regularSlotId = uuidv4();
    walkinSlotId = uuidv4();

    await db('schedule_slots').insert([
      {
        id: regularSlotId,
        clinic_id: clinicId,
        slot_date: todayDate,
        start_time: '23:00:00',
        end_time: '23:20:00',
        is_walkin: false,
        is_blocked: false,
      },
      {
        id: walkinSlotId,
        clinic_id: clinicId,
        slot_date: todayDate,
        start_time: '23:20:00',
        end_time: '23:40:00',
        is_walkin: true,
        is_blocked: false,
      },
    ]);

    appt1Id = uuidv4();
    await db('appointments').insert({
      id: appt1Id,
      mother_id: mother1Id,
      clinic_id: clinicId,
      slot_id: regularSlotId,
      status: 'checked_in',
      booking_type: 'mother',
      queue_number: 'ANC-001',
      checked_in_at: new Date(),
    });
  });

  describe('Walk-in Slots Rule', () => {
    it('should exclude walk-in slots for unauthenticated caller', async () => {
      const res = await request(app).get(`/api/clinics/${clinicId}/slots?date=${todayDate}`);
      expect(res.statusCode).toBe(200);
      const slots = res.body.data.availableSlots;
      expect(slots.some((s) => s.is_walkin)).toBe(false);
    });

    it('should exclude walk-in slots for mother caller', async () => {
      const res = await request(app)
        .get(`/api/clinics/${clinicId}/slots?date=${todayDate}`)
        .set('Authorization', `Bearer ${mother1Token}`);
      expect(res.statusCode).toBe(200);
      const slots = res.body.data.availableSlots;
      expect(slots.some((s) => s.is_walkin)).toBe(false);
    });

    it('should include walk-in slots for staff caller', async () => {
      const res = await request(app)
        .get(`/api/clinics/${clinicId}/slots?date=${todayDate}`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.statusCode).toBe(200);
      const slots = res.body.data.availableSlots;
      expect(slots.some((s) => s.is_walkin)).toBe(true);
    });

    it('should reject mother attempting to book a walk-in slot with SLOT_RESERVED', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${mother2Token}`)
        .send({
          clinic_id: clinicId,
          slot_id: walkinSlotId,
          booking_type: 'mother',
        });
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('SLOT_RESERVED');
    });
  });

  describe('Ownership Checks', () => {
    it('should deny Mother Two from viewing Mother One appointment with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get(`/api/appointments/${appt1Id}`)
        .set('Authorization', `Bearer ${mother2Token}`);
      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow Mother One to view her own appointment', async () => {
      const res = await request(app)
        .get(`/api/appointments/${appt1Id}`)
        .set('Authorization', `Bearer ${mother1Token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.id).toBe(appt1Id);
    });

    it('should deny Mother Two from viewing Mother One queue position with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get(`/api/queue/position/${appt1Id}`)
        .set('Authorization', `Bearer ${mother2Token}`);
      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should strip patient names for mother viewing clinic queue', async () => {
      const res = await request(app)
        .get(`/api/queue/today/${clinicId}`)
        .set('Authorization', `Bearer ${mother2Token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.queue.length).toBeGreaterThan(0);
      res.body.data.queue.forEach((q) => {
        expect(q.mother_name).toBeUndefined();
        expect(q.queue_number).toBeDefined();
      });
    });
  });

  describe('Audit Logging', () => {
    it('should record LOGIN_FAILURE audit log on bad credentials without logging passwords', async () => {
      const auditCountBefore = await db('audit_logs').where('action', 'LOGIN_FAILURE').count('* as count').first();
      await request(app)
        .post('/api/auth/login')
        .send({ phone: phone1, password: 'wrongpassword' });

      const auditCountAfter = await db('audit_logs').where('action', 'LOGIN_FAILURE').count('* as count').first();
      expect(parseInt(auditCountAfter.count)).toBeGreaterThan(parseInt(auditCountBefore.count));

      const log = await db('audit_logs').where('action', 'LOGIN_FAILURE').orderBy('created_at', 'desc').first();
      expect(log.details).not.toContain('wrongpassword');
    });

    it('should record STAFF_VIEW_MOTHER_PROFILE when staff views a mother profile', async () => {
      const res = await request(app)
        .get(`/api/mothers/${mother1Id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.statusCode).toBe(200);

      const log = await db('audit_logs')
        .where('action', 'STAFF_VIEW_MOTHER_PROFILE')
        .where('user_id', staffId)
        .first();
      expect(log).toBeDefined();
    });
  });

  describe('A1: No-Show Status Updates and Role Permissions', () => {
    let noShowSlotId, noShowApptId;

    beforeAll(async () => {
      noShowSlotId = uuidv4();
      await db('schedule_slots').insert({
        id: noShowSlotId,
        clinic_id: clinicId,
        slot_date: todayDate,
        start_time: '07:00:00',
        end_time: '07:20:00',
        is_walkin: false,
        is_blocked: false,
      });

      noShowApptId = uuidv4();
      await db('appointments').insert({
        id: noShowApptId,
        mother_id: mother2Id,
        clinic_id: clinicId,
        slot_id: noShowSlotId,
        status: 'booked',
        booking_type: 'mother',
        booked_at: new Date(),
        late_arrival: false,
      });
    });

    it('should refuse front desk from setting status to waiting, in_consultation, or completed with 403 FORBIDDEN', async () => {
      const waitRes = await request(app)
        .put(`/api/appointments/${appt1Id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'waiting' });
      expect(waitRes.statusCode).toBe(403);
      expect(waitRes.body.error.code).toBe('FORBIDDEN');

      const consultRes = await request(app)
        .put(`/api/appointments/${appt1Id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'in_consultation' });
      expect(consultRes.statusCode).toBe(403);
      expect(consultRes.body.error.code).toBe('FORBIDDEN');

      const compRes = await request(app)
        .put(`/api/appointments/${appt1Id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'completed' });
      expect(compRes.statusCode).toBe(403);
      expect(compRes.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow front desk and admin to mark status no_show (after grace period)', async () => {
      // Slot was 07:00:00 today. Cutoff (07:15) has expired.
      const res = await request(app)
        .put(`/api/appointments/${noShowApptId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'no_show' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const inDb = await db('appointments').where('id', noShowApptId).first();
      expect(inDb.status).toBe('no_show');
    });

    it('should allow doctor/midwife/admin to set waiting, in_consultation, and completed', async () => {
      const consultRes = await request(app)
        .put(`/api/appointments/${appt1Id}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ status: 'in_consultation' });
      expect(consultRes.statusCode).toBe(200);

      const compRes = await request(app)
        .put(`/api/appointments/${appt1Id}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ status: 'completed' });
      expect(compRes.statusCode).toBe(200);

      const inDb = await db('appointments').where('id', appt1Id).first();
      expect(inDb.status).toBe('completed');
    });
  });

  describe('A2: Booking Type per Clinic Rules', () => {
    let ancFutureSlotId, pncFutureSlotId;
    const futureDate = '2026-12-28';

    beforeAll(async () => {
      ancFutureSlotId = uuidv4();
      pncFutureSlotId = uuidv4();

      await db('schedule_slots').insert([
        {
          id: ancFutureSlotId,
          clinic_id: clinicId,
          slot_date: futureDate,
          start_time: '10:00:00',
          end_time: '10:20:00',
          is_walkin: false,
          is_blocked: false,
        },
        {
          id: pncFutureSlotId,
          clinic_id: pncClinicId,
          slot_date: futureDate,
          start_time: '14:00:00',
          end_time: '14:30:00',
          is_walkin: false,
          is_blocked: false,
        },
      ]);
    });

    it('should refuse Antenatal clinic booking with baby or both with 400 BOOKING_TYPE_INVALID', async () => {
      const babyRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${mother1Token}`)
        .send({
          clinic_id: clinicId,
          slot_id: ancFutureSlotId,
          booking_type: 'baby',
          baby_ids: [baby1Id],
        });
      expect(babyRes.statusCode).toBe(400);
      expect(babyRes.body.error.code).toBe('BOOKING_TYPE_INVALID');

      const bothRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${mother1Token}`)
        .send({
          clinic_id: clinicId,
          slot_id: ancFutureSlotId,
          booking_type: 'both',
          baby_ids: [baby1Id],
        });
      expect(bothRes.statusCode).toBe(400);
      expect(bothRes.body.error.code).toBe('BOOKING_TYPE_INVALID');
    });

    it('should refuse booking with invalid booking_type string with 400 BOOKING_TYPE_INVALID', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${mother1Token}`)
        .send({
          clinic_id: pncClinicId,
          slot_id: pncFutureSlotId,
          booking_type: 'invalid_type',
        });
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('BOOKING_TYPE_INVALID');
    });

    it('should refuse Postnatal clinic booking for baby or both without baby_ids or with non-owned baby_ids', async () => {
      const noBabiesRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${mother1Token}`)
        .send({
          clinic_id: pncClinicId,
          slot_id: pncFutureSlotId,
          booking_type: 'baby',
        });
      expect(noBabiesRes.statusCode).toBe(400);
      expect(noBabiesRes.body.error.code).toBe('BOOKING_TYPE_INVALID');

      const otherBabyRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${mother1Token}`)
        .send({
          clinic_id: pncClinicId,
          slot_id: pncFutureSlotId,
          booking_type: 'both',
          baby_ids: [otherMotherBabyId],
        });
      expect(otherBabyRes.statusCode).toBe(400);
      expect(otherBabyRes.body.error.code).toBe('BOOKING_TYPE_INVALID');
    });

    it('should allow Antenatal booking with mother, and Postnatal booking with baby', async () => {
      const ancRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${mother1Token}`)
        .send({
          clinic_id: clinicId,
          slot_id: ancFutureSlotId,
          booking_type: 'mother',
        });
      expect(ancRes.statusCode).toBe(201);
      expect(ancRes.body.data.booking_type).toBe('mother');

      const pncRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${mother1Token}`)
        .send({
          clinic_id: pncClinicId,
          slot_id: pncFutureSlotId,
          booking_type: 'baby',
          baby_ids: [baby1Id],
        });
      expect(pncRes.statusCode).toBe(201);
      expect(pncRes.body.data.booking_type).toBe('baby');
    });

    it('should refuse rescheduling a baby booking into an Antenatal clinic slot with 400 BOOKING_TYPE_INVALID', async () => {
      const pncAppt = await db('appointments').where('slot_id', pncFutureSlotId).first();

      const newAncSlotId = uuidv4();
      await db('schedule_slots').insert({
        id: newAncSlotId,
        clinic_id: clinicId,
        slot_date: futureDate,
        start_time: '11:00:00',
        end_time: '11:20:00',
        is_walkin: false,
        is_blocked: false,
      });

      const reschedRes = await request(app)
        .put(`/api/appointments/${pncAppt.id}/reschedule`)
        .set('Authorization', `Bearer ${mother1Token}`)
        .send({
          new_slot_id: newAncSlotId,
          booking_type: 'baby',
        });

      expect(reschedRes.statusCode).toBe(400);
      expect(reschedRes.body.error.code).toBe('BOOKING_TYPE_INVALID');
    });
  });

  describe('A3: Admin Slot Generation (POST /api/admin/slots/generate)', () => {
    it('should refuse slot generation for non-admin users with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .post('/api/admin/slots/generate')
        .set('Authorization', `Bearer ${mother1Token}`)
        .send({
          clinic_id: clinicId,
          from_date: '2026-12-01',
          to_date: '2026-12-02',
          start_time: '08:00',
          end_time: '12:00',
        });
      expect(res.statusCode).toBe(403);
    });

    it('should refuse slot generation for past dates with 400 BAD_REQUEST', async () => {
      const res = await request(app)
        .post('/api/admin/slots/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clinic_id: clinicId,
          from_date: '2026-01-01',
          to_date: '2026-01-02',
          start_time: '08:00',
          end_time: '12:00',
        });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('past');
    });

    it('should refuse slot generation for date ranges over 31 days with 400 BAD_REQUEST', async () => {
      const res = await request(app)
        .post('/api/admin/slots/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clinic_id: clinicId,
          from_date: '2027-01-01',
          to_date: '2027-02-15',
          start_time: '08:00',
          end_time: '12:00',
        });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('31 days');
    });

    it('should generate slots, spread walk-ins evenly (~20%), skip existing on repeat, and write audit log', async () => {
      const genRes = await request(app)
        .post('/api/admin/slots/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clinic_id: clinicId,
          from_date: '2027-03-01',
          to_date: '2027-03-02',
          start_time: '08:00',
          end_time: '10:00',
          weekdays: [1, 2],
        });

      expect(genRes.statusCode).toBe(201);
      expect(genRes.body.success).toBe(true);
      expect(genRes.body.data.created).toBe(12);
      expect(genRes.body.data.skipped).toBe(0);

      const slots = await db('schedule_slots')
        .where('clinic_id', clinicId)
        .whereIn('slot_date', ['2027-03-01', '2027-03-02'])
        .orderBy('start_time', 'asc');

      const walkinCount = slots.filter((s) => Boolean(s.is_walkin)).length;
      expect(walkinCount).toBeGreaterThan(0);
      const day1Slots = slots.filter((s) => s.slot_date === '2027-03-01');
      expect(Boolean(day1Slots[2].is_walkin)).toBe(true);

      const repeatRes = await request(app)
        .post('/api/admin/slots/generate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          clinic_id: clinicId,
          from_date: '2027-03-01',
          to_date: '2027-03-02',
          start_time: '08:00',
          end_time: '10:00',
          weekdays: [1, 2],
        });

      expect(repeatRes.statusCode).toBe(201);
      expect(repeatRes.body.data.created).toBe(0);
      expect(repeatRes.body.data.skipped).toBe(12);

      const auditLog = await db('audit_logs')
        .where('action', 'GENERATE_SLOTS')
        .orderBy('created_at', 'desc')
        .first();
      expect(auditLog).toBeDefined();
      expect(auditLog.user_id).toBe(adminId);
    });
  });

  afterAll(async () => {
    await db.destroy();
  });
});
