const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { v4: uuidv4 } = require('uuid');
const { getLagosToday } = require('../src/utils/helpers');

describe('Security, Walk-in Rules, and Audit Logging', () => {
  let clinicId, mother1Id, mother2Id, staffId;
  let mother1Token, mother2Token, staffToken;
  let regularSlotId, walkinSlotId, appt1Id;
  const todayDate = getLagosToday();
  const phone1 = `+23480${Math.floor(10000000 + Math.random() * 90000000)}`;
  const phone2 = `+23480${Math.floor(10000000 + Math.random() * 90000000)}`;
  const phone3 = `+23480${Math.floor(10000000 + Math.random() * 90000000)}`;

  beforeAll(async () => {
    await db.migrate.latest();

    clinicId = uuidv4();
    await db('clinics').insert({
      id: clinicId,
      name: 'ANC Test Clinic',
      slot_duration_min: 20,
      walkin_reserve_pct: 0.2,
    });

    mother1Id = uuidv4();
    mother2Id = uuidv4();
    staffId = uuidv4();

    await db('mothers').insert([
      { id: mother1Id, phone: phone1, name: 'Mother One', password_hash: 'hash', is_verified: true, role: 'mother' },
      { id: mother2Id, phone: phone2, name: 'Mother Two', password_hash: 'hash', is_verified: true, role: 'mother' },
    ]);

    await db('staff').insert({
      id: staffId,
      name: 'Front Desk Officer',
      role: 'front_desk',
      phone: phone3,
      password_hash: 'hash',
    });

    mother1Token = jwt.sign({ id: mother1Id, role: 'mother', name: 'Mother One' }, config.jwt.secret);
    mother2Token = jwt.sign({ id: mother2Id, role: 'mother', name: 'Mother Two' }, config.jwt.secret);
    staffToken = jwt.sign({ id: staffId, role: 'front_desk', name: 'Front Desk Officer' }, config.jwt.secret);

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

  afterAll(async () => {
    await db.destroy();
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
});
