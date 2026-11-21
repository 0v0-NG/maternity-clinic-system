const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { v4: uuidv4 } = require('uuid');

describe('A1 & A2: Past Slots and Controlled Clock Cutoff Rules', () => {
  let clinicId, motherId, staffId, doctorId;
  let motherToken, staffToken, doctorToken;

  beforeAll(async () => {
    await db.migrate.latest();

    clinicId = uuidv4();
    await db('clinics').insert({
      id: clinicId,
      name: 'Cutoff ANC Clinic',
      slot_duration_min: 20,
      walkin_reserve_pct: 0.2,
    });

    motherId = uuidv4();
    staffId = uuidv4();
    doctorId = uuidv4();

    await db('mothers').insert({
      id: motherId,
      phone: `+23480${Math.floor(10000000 + Math.random() * 90000000)}`,
      name: 'Cutoff Mother',
      password_hash: 'hash',
      is_verified: true,
      consent_at: new Date(),
      role: 'mother',
    });

    await db('staff').insert([
      {
        id: staffId,
        phone: `+23480${Math.floor(10000000 + Math.random() * 90000000)}`,
        name: 'Front Desk Clock Officer',
        role: 'front_desk',
        password_hash: 'hash',
      },
      {
        id: doctorId,
        phone: `+23480${Math.floor(10000000 + Math.random() * 90000000)}`,
        name: 'Dr. Clock Specialist',
        role: 'doctor',
        password_hash: 'hash',
      },
    ]);

    motherToken = jwt.sign({ id: motherId, role: 'mother', name: 'Cutoff Mother' }, config.jwt.secret);
    staffToken = jwt.sign({ id: staffId, role: 'front_desk', name: 'Front Desk Clock Officer' }, config.jwt.secret);
    doctorToken = jwt.sign({ id: doctorId, role: 'doctor', name: 'Dr. Clock Specialist' }, config.jwt.secret);
  });

  afterAll(async () => {
    jest.useRealTimers();
    await db.destroy();
  });

  describe('A1: Past Slot Rules (SLOT_PAST)', () => {
    let pastSlotId, ongoingSlotId, endedSlotId;

    beforeAll(async () => {
      pastSlotId = uuidv4();
      ongoingSlotId = uuidv4();
      endedSlotId = uuidv4();

      await db('schedule_slots').insert([
        {
          id: pastSlotId,
          clinic_id: clinicId,
          slot_date: '2026-12-05',
          start_time: '08:00:00',
          end_time: '08:20:00',
          is_walkin: false,
          is_blocked: false,
        },
        {
          id: ongoingSlotId,
          clinic_id: clinicId,
          slot_date: '2026-12-05',
          start_time: '09:00:00',
          end_time: '09:20:00',
          is_walkin: true,
          is_blocked: false,
        },
        {
          id: endedSlotId,
          clinic_id: clinicId,
          slot_date: '2026-12-05',
          start_time: '07:00:00',
          end_time: '07:20:00',
          is_walkin: true,
          is_blocked: false,
        },
      ]);
    });

    it('should refuse mother booking a slot whose start time has passed with 400 SLOT_PAST', async () => {
      // Clock is at 08:30:00 Lagos time (+01:00) on 2026-12-05 -> pastSlot (08:00-08:20) has passed
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-12-05T08:30:00+01:00'));

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${motherToken}`)
        .send({
          clinic_id: clinicId,
          slot_id: pastSlotId,
          booking_type: 'mother',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('SLOT_PAST');

      jest.useRealTimers();
    });

    it('should allow staff to book a walk-in slot on today that has started but not ended', async () => {
      // Clock is at 09:10:00 Lagos time -> ongoingSlot (09:00-09:20) has started but not ended
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-12-05T09:10:00+01:00'));

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          clinic_id: clinicId,
          slot_id: ongoingSlotId,
          mother_id: motherId,
          booking_type: 'mother',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.id).toBeDefined();

      jest.useRealTimers();
    });

    it('should refuse staff booking a walk-in slot that has already ended with 400 SLOT_PAST', async () => {
      // Clock is at 09:10:00 Lagos time -> endedSlot (07:00-07:20) ended long ago
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-12-05T09:10:00+01:00'));

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          clinic_id: clinicId,
          slot_id: endedSlotId,
          mother_id: motherId,
          booking_type: 'mother',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('SLOT_PAST');

      jest.useRealTimers();
    });
  });

  describe('A2: Controlled Clock 4-Hour Cutoff (CUTOFF_PASSED)', () => {
    let apptSlotId, futureNewSlotId, testApptId;

    beforeAll(async () => {
      apptSlotId = uuidv4();
      futureNewSlotId = uuidv4();

      await db('schedule_slots').insert([
        {
          id: apptSlotId,
          clinic_id: clinicId,
          slot_date: '2026-12-10',
          start_time: '10:00:00',
          end_time: '10:20:00',
          is_walkin: false,
          is_blocked: false,
        },
        {
          id: futureNewSlotId,
          clinic_id: clinicId,
          slot_date: '2026-12-10',
          start_time: '14:00:00',
          end_time: '14:20:00',
          is_walkin: false,
          is_blocked: false,
        },
      ]);

      testApptId = uuidv4();
      await db('appointments').insert({
        id: testApptId,
        mother_id: motherId,
        clinic_id: clinicId,
        slot_id: apptSlotId,
        status: 'booked',
        booking_type: 'mother',
        booked_at: new Date('2026-12-01T10:00:00Z'),
      });
    });

    it('should refuse cancel and reschedule with 400 CUTOFF_PASSED inside 4 hours', async () => {
      // Slot is at 2026-12-10 10:00:00 Lagos time (+01:00)
      // Clock at 2026-12-10 07:30:00 Lagos time (2.5 hours before slot -> inside 4h cutoff)
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-12-10T07:30:00+01:00'));

      // 1. Attempt cancel
      const cancelRes = await request(app)
        .put(`/api/appointments/${testApptId}/cancel`)
        .set('Authorization', `Bearer ${motherToken}`)
        .send({ reason: 'Cannot make it' });

      expect(cancelRes.statusCode).toBe(400);
      expect(cancelRes.body.error.code).toBe('CUTOFF_PASSED');

      // 2. Attempt reschedule
      const reschedRes = await request(app)
        .put(`/api/appointments/${testApptId}/reschedule`)
        .set('Authorization', `Bearer ${motherToken}`)
        .send({ new_slot_id: futureNewSlotId });

      expect(reschedRes.statusCode).toBe(400);
      expect(reschedRes.body.error.code).toBe('CUTOFF_PASSED');

      jest.useRealTimers();
    });

    it('should allow reschedule and cancel outside 4 hours', async () => {
      // Clock at 2026-12-10 05:00:00 Lagos time (5 hours before 10:00:00 slot -> outside 4h cutoff)
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-12-10T05:00:00+01:00'));

      // 1. Reschedule should succeed
      const reschedRes = await request(app)
        .put(`/api/appointments/${testApptId}/reschedule`)
        .set('Authorization', `Bearer ${motherToken}`)
        .send({ new_slot_id: futureNewSlotId });

      expect(reschedRes.statusCode).toBe(200);
      expect(reschedRes.body.success).toBe(true);

      // Verify slot moved to futureNewSlotId in DB
      const updatedAppt = await db('appointments').where('id', testApptId).first();
      expect(updatedAppt.slot_id).toBe(futureNewSlotId);

      // 2. Cancel should succeed outside 4 hours of the new slot (new slot is 14:00:00, clock is 05:00:00 -> 9 hours ahead)
      const cancelRes = await request(app)
        .put(`/api/appointments/${testApptId}/cancel`)
        .set('Authorization', `Bearer ${motherToken}`)
        .send({ reason: 'Personal conflict' });

      expect(cancelRes.statusCode).toBe(200);
      expect(cancelRes.body.success).toBe(true);

      const cancelledAppt = await db('appointments').where('id', testApptId).first();
      expect(cancelledAppt.status).toBe('cancelled');

      jest.useRealTimers();
    });
  });

  describe('Late-Arrival Grace Period and Check-in Rules', () => {
    let slotEarlyId, slotLateId, slotNoShowId, slotDiffDateId;
    let apptEarlyId, apptLateId, apptNoShowId, apptDiffDateId;
    let motherEarlyId, motherLateId, motherNoShowId, motherDiffDateId;
    let motherEarlyToken, motherLateToken;

    beforeAll(async () => {
      slotEarlyId = uuidv4();
      slotLateId = uuidv4();
      slotNoShowId = uuidv4();
      slotDiffDateId = uuidv4();

      await db('schedule_slots').insert([
        {
          id: slotEarlyId,
          clinic_id: clinicId,
          slot_date: '2026-12-25',
          start_time: '10:00:00',
          end_time: '10:20:00',
          is_walkin: false,
          is_blocked: false,
        },
        {
          id: slotLateId,
          clinic_id: clinicId,
          slot_date: '2026-12-25',
          start_time: '10:00:00',
          end_time: '10:20:00',
          is_walkin: false,
          is_blocked: false,
        },
        {
          id: slotNoShowId,
          clinic_id: clinicId,
          slot_date: '2026-12-25',
          start_time: '11:00:00',
          end_time: '11:20:00',
          is_walkin: false,
          is_blocked: false,
        },
        {
          id: slotDiffDateId,
          clinic_id: clinicId,
          slot_date: '2026-12-26',
          start_time: '10:00:00',
          end_time: '10:20:00',
          is_walkin: false,
          is_blocked: false,
        },
      ]);

      motherEarlyId = uuidv4();
      motherLateId = uuidv4();
      motherNoShowId = uuidv4();
      motherDiffDateId = uuidv4();

      await db('mothers').insert([
        {
          id: motherEarlyId,
          phone: `+23480${Math.floor(10000000 + Math.random() * 90000000)}`,
          name: 'Early Mother',
          password_hash: 'hash',
          is_verified: true,
          consent_at: new Date(),
          role: 'mother',
        },
        {
          id: motherLateId,
          phone: `+23480${Math.floor(10000000 + Math.random() * 90000000)}`,
          name: 'Late Mother',
          password_hash: 'hash',
          is_verified: true,
          consent_at: new Date(),
          role: 'mother',
        },
        {
          id: motherNoShowId,
          phone: `+23480${Math.floor(10000000 + Math.random() * 90000000)}`,
          name: 'NoShow Mother',
          password_hash: 'hash',
          is_verified: true,
          consent_at: new Date(),
          role: 'mother',
        },
        {
          id: motherDiffDateId,
          phone: `+23480${Math.floor(10000000 + Math.random() * 90000000)}`,
          name: 'DiffDate Mother',
          password_hash: 'hash',
          is_verified: true,
          consent_at: new Date(),
          role: 'mother',
        },
      ]);

      motherEarlyToken = jwt.sign({ id: motherEarlyId, role: 'mother', name: 'Early Mother' }, config.jwt.secret);
      motherLateToken = jwt.sign({ id: motherLateId, role: 'mother', name: 'Late Mother' }, config.jwt.secret);

      apptEarlyId = uuidv4();
      apptLateId = uuidv4();
      apptNoShowId = uuidv4();
      apptDiffDateId = uuidv4();

      await db('appointments').insert([
        {
          id: apptEarlyId,
          mother_id: motherEarlyId,
          clinic_id: clinicId,
          slot_id: slotEarlyId,
          status: 'booked',
          booking_type: 'mother',
          booked_at: new Date('2026-12-01T10:00:00Z'),
          late_arrival: false,
        },
        {
          id: apptLateId,
          mother_id: motherLateId,
          clinic_id: clinicId,
          slot_id: slotLateId,
          status: 'booked',
          booking_type: 'mother',
          booked_at: new Date('2026-12-01T10:00:00Z'),
          late_arrival: false,
        },
        {
          id: apptNoShowId,
          mother_id: motherNoShowId,
          clinic_id: clinicId,
          slot_id: slotNoShowId,
          status: 'booked',
          booking_type: 'mother',
          booked_at: new Date('2026-12-01T10:00:00Z'),
          late_arrival: false,
        },
        {
          id: apptDiffDateId,
          mother_id: motherDiffDateId,
          clinic_id: clinicId,
          slot_id: slotDiffDateId,
          status: 'booked',
          booking_type: 'mother',
          booked_at: new Date('2026-12-01T10:00:00Z'),
          late_arrival: false,
        },
      ]);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should refuse check-in on another date with 400 CHECKIN_NOT_ALLOWED', async () => {
      // Clock is at 2026-12-25T10:00:00+01:00 (today is 2026-12-25)
      // apptDiffDateId is booked on 2026-12-26
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-12-25T10:00:00+01:00'));

      const res = await request(app)
        .post(`/api/appointments/${apptDiffDateId}/checkin`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('CHECKIN_NOT_ALLOWED');
    });

    it('should allow check-in at start+10 min with late_arrival = false', async () => {
      // Slot starts at 10:00:00. Clock at 10:10:00 (+10 min, within 15 min grace)
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-12-25T10:10:00+01:00'));

      const res = await request(app)
        .post(`/api/appointments/${apptEarlyId}/checkin`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.late_arrival).toBe(false);
      expect(res.body.data.queueNumber).toBeDefined();

      const inDb = await db('appointments').where('id', apptEarlyId).first();
      expect(inDb.status).toBe('checked_in');
      expect(Boolean(inDb.late_arrival)).toBe(false);
    });

    it('should allow check-in at start+25 min with late_arrival = true and place mother at end of queue', async () => {
      // Slot starts at 10:00:00. Clock at 10:25:00 (+25 min, beyond 15 min grace)
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-12-25T10:25:00+01:00'));

      const res = await request(app)
        .post(`/api/appointments/${apptLateId}/checkin`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.late_arrival).toBe(true);

      const inDb = await db('appointments').where('id', apptLateId).first();
      expect(inDb.status).toBe('checked_in');
      expect(Boolean(inDb.late_arrival)).toBe(true);

      // Check queue position: late arrival checked in at 10:25, early arrival checked in at 10:10
      // Late mother must be position 2 (after early mother)
      const posRes = await request(app)
        .get(`/api/queue/position/${apptLateId}`)
        .set('Authorization', `Bearer ${motherLateToken}`);

      expect(posRes.statusCode).toBe(200);
      expect(posRes.body.data.position).toBe(2);
      expect(posRes.body.data.late_arrival).toBe(true);

      // Verify GET /api/queue/today/:clinicId includes late_arrival
      // Mother caller: sanitized (no patient names)
      const queueMotherRes = await request(app)
        .get(`/api/queue/today/${clinicId}`)
        .set('Authorization', `Bearer ${motherLateToken}`);

      expect(queueMotherRes.statusCode).toBe(200);
      expect(queueMotherRes.body.data.queue.length).toBeGreaterThanOrEqual(2);
      queueMotherRes.body.data.queue.forEach((item) => {
        expect(item.late_arrival).toBeDefined();
        expect(item.mother_name).toBeUndefined(); // Mother must never see other patient names
      });

      // Staff caller: includes patient names and late_arrival
      const queueStaffRes = await request(app)
        .get(`/api/queue/today/${clinicId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(queueStaffRes.statusCode).toBe(200);
      const earlyEntry = queueStaffRes.body.data.queue.find((q) => q.id === apptEarlyId);
      const lateEntry = queueStaffRes.body.data.queue.find((q) => q.id === apptLateId);
      expect(earlyEntry.late_arrival).toBe(false);
      expect(earlyEntry.mother_name).toBe('Early Mother');
      expect(lateEntry.late_arrival).toBe(true);
      expect(lateEntry.mother_name).toBe('Late Mother');
    });

    it('should refuse marking no_show at start+10 min with 400 NO_SHOW_TOO_EARLY', async () => {
      // Slot starts at 11:00:00. Grace cutoff is 11:15:00.
      // Clock at 11:10:00 (+10 min, within grace period)
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-12-25T11:10:00+01:00'));

      const res = await request(app)
        .put(`/api/appointments/${apptNoShowId}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ status: 'no_show' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('NO_SHOW_TOO_EARLY');
    });

    it('should allow marking no_show at start+20 min (after grace expires)', async () => {
      // Slot starts at 11:00:00. Grace cutoff was 11:15:00.
      // Clock at 11:20:00 (+20 min, grace expired)
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-12-25T11:20:00+01:00'));

      const res = await request(app)
        .put(`/api/appointments/${apptNoShowId}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ status: 'no_show' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const inDb = await db('appointments').where('id', apptNoShowId).first();
      expect(inDb.status).toBe('no_show');
    });

    it('should refuse marking no_show for an appointment that has already checked in', async () => {
      // apptEarlyId is already 'checked_in'
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-12-25T11:30:00+01:00'));

      const res = await request(app)
        .put(`/api/appointments/${apptEarlyId}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ status: 'no_show' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('should refuse check-in for an appointment that is already checked in', async () => {
      // apptEarlyId is already checked_in
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(new Date('2026-12-25T11:30:00+01:00'));

      const res = await request(app)
        .post(`/api/appointments/${apptEarlyId}/checkin`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('CHECKIN_NOT_ALLOWED');
    });
  });
});
