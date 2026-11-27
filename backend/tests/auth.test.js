const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');

describe('Auth Endpoints', () => {
  beforeAll(async () => {
    await db.migrate.latest();
  });

  describe('POST /api/auth/register', () => {
    it('should return 422 when phone is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', password: 'password123', consent: true });

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors).toBeDefined();
    });

    it('should return 422 when password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ phone: '08012345678', name: 'Test', password: '123', consent: true });

      expect(res.statusCode).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 when consent is missing or false', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ phone: '08012345678', name: 'Test', password: 'password123' });

      expect(res.statusCode).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 when hospital_id exceeds 50 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '08012345678',
          name: 'Long Hospital ID Mother',
          password: 'password123',
          consent: true,
          hospital_id: 'H'.repeat(51),
        });

      expect(res.statusCode).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 when hmo_number exceeds 50 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: '08012345678',
          name: 'Long HMO Mother',
          password: 'password123',
          consent: true,
          hmo_number: 'H'.repeat(51),
        });

      expect(res.statusCode).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should register mother with optional hospital_id and hmo_number, trimming strings and saving to DB', async () => {
      const testPhone = `080${Math.floor(10000000 + Math.random() * 90000000)}`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: testPhone,
          name: 'Hospital HMO Mother',
          password: 'password123',
          consent: true,
          hospital_id: '  HOSP-TEST-001  ',
          hmo_number: '  HMO-TEST-002  ',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.motherId).toBeDefined();

      const mother = await db('mothers').where('id', res.body.data.motherId).first();
      expect(mother).toBeDefined();
      expect(mother.hospital_id).toBe('HOSP-TEST-001');
      expect(mother.hmo_number).toBe('HMO-TEST-002');
    });

    it('should convert empty strings for hospital_id and hmo_number to null in DB', async () => {
      const testPhone = `080${Math.floor(10000000 + Math.random() * 90000000)}`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          phone: testPhone,
          name: 'Empty Optional Mother',
          password: 'password123',
          consent: true,
          hospital_id: '   ',
          hmo_number: '',
        });

      expect(res.statusCode).toBe(201);
      const mother = await db('mothers').where('id', res.body.data.motherId).first();
      expect(mother).toBeDefined();
      expect(mother.hospital_id).toBeNull();
      expect(mother.hmo_number).toBeNull();
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('should verify OTP and return token, refreshToken, and user object matching login response shape', async () => {
      const testPhone = `080${Math.floor(10000000 + Math.random() * 90000000)}`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          phone: testPhone,
          name: 'Verify Full Shape Mother',
          password: 'password123',
          consent: true,
          hospital_id: 'HOSP-VERIFY-01',
          hmo_number: 'HMO-VERIFY-01',
        });

      expect(regRes.statusCode).toBe(201);
      const { motherId, pinId, demoOtp } = regRes.body.data;

      const verifyRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          motherId,
          pinId,
          otp: demoOtp || '123456',
        });

      expect(verifyRes.statusCode).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.message).toBe('Phone number verified successfully.');
      expect(verifyRes.body.data).toBeDefined();
      expect(typeof verifyRes.body.data.token).toBe('string');
      expect(typeof verifyRes.body.data.refreshToken).toBe('string');
      expect(verifyRes.body.data.user).toEqual({
        id: motherId,
        name: 'Verify Full Shape Mother',
        phone: testPhone.replace(/^0/, '+234'),
        role: 'mother',
        is_verified: true,
      });

      const updated = await db('mothers').where('id', motherId).first();
      expect(Boolean(updated.is_verified)).toBe(true);
    });
  });

  describe('PUT /api/mothers/profile', () => {
    it('should return created_at along with updated fields', async () => {
      const testPhone = `080${Math.floor(10000000 + Math.random() * 90000000)}`;
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          phone: testPhone,
          name: 'Profile Mother',
          password: 'password123',
          consent: true,
        });

      const { motherId, pinId, demoOtp } = regRes.body.data;
      const verifyRes = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          motherId,
          pinId,
          otp: demoOtp || '123456',
        });

      const token = verifyRes.body.data.token;

      const profileRes = await request(app)
        .put('/api/mothers/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Profile Mother Updated',
          hospital_id: 'HOSP-UPDATED-001',
          hmo_number: 'HMO-UPDATED-001',
        });

      expect(profileRes.statusCode).toBe(200);
      expect(profileRes.body.success).toBe(true);
      expect(profileRes.body.data).toBeDefined();
      expect(profileRes.body.data.id).toBe(motherId);
      expect(profileRes.body.data.name).toBe('Profile Mother Updated');
      expect(profileRes.body.data.hospital_id).toBe('HOSP-UPDATED-001');
      expect(profileRes.body.data.hmo_number).toBe('HMO-UPDATED-001');
      expect(profileRes.body.data.created_at).toBeDefined();
      expect(profileRes.body.data.created_at).not.toBeNull();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 422 when fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.statusCode).toBe(422);
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/health');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/clinic-info & GET /api/emergency-notice', () => {
    it('should return confirmed BUK hospital details, clinic contacts, sessionNote, and slot lengths from DB', async () => {
      const { v4: uuidv4 } = require('uuid');
      const ancId = uuidv4();
      const pncId = uuidv4();

      await db('clinics').insert([
        { id: ancId, name: 'Antenatal Clinic', slot_duration_min: 25, walkin_reserve_pct: 0.2 },
        { id: pncId, name: 'Postnatal Clinic', slot_duration_min: 35, walkin_reserve_pct: 0.2 },
      ]);

      const res = await request(app).get('/api/clinic-info');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.confirmedFromInterview).toBe(true);
      expect(res.body.data.hospitalName).toBe(
        'University Health Services, Bayero University, Kano - Ante-Natal Clinic'
      );
      expect(res.body.data.address).toBe(
        'Inside the main University Health Services Clinic, BUK New Site, Rimin Gata, Gwarzo Road, Kano'
      );
      expect(res.body.data.clinicPhone).toBe('0810 704 7641');
      expect(res.body.data.clinicEmail).toBe('info.clinic@buk.edu.ng');
      expect(res.body.data.sessionNote).toBe(
        'Monday is registration day. Wednesday is immunisation, which this system does not cover.'
      );
      expect(res.body.data.clinicDaysAndHours.antenatal.days).toEqual(['Tuesday', 'Thursday']);
      expect(res.body.data.clinicDaysAndHours.postnatal.days).toEqual(['Tuesday', 'Thursday']);
      expect(res.body.data.clinicDaysAndHours.antenatal.slotDurationMinutes).toBe(25);
      expect(res.body.data.clinicDaysAndHours.postnatal.slotDurationMinutes).toBe(35);
      expect(res.body.data.emergencyUnitNumber).toBeUndefined();
      expect(res.body.data.googleMapsUrl).toContain('https://www.google.com/maps/search/');

      await db('clinics').whereIn('id', [ancId, pncId]).del();
    });

    it('should return the clinic-wide non-emergency notice on GET /api/emergency-notice', async () => {
      const res = await request(app).get('/api/emergency-notice');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(
        'Labour or an emergency? This clinic does not handle deliveries or emergencies. Go straight to the nearest hospital emergency unit.'
      );
    });
  });

  describe('CORS Configuration', () => {
    it('should set Access-Control-Allow-Origin header for http://localhost:3000', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });

  describe('Consistent Error Response Format', () => {
    it('should return structured { error: { code, message } } on 401 Unauthorized', async () => {
      const res = await request(app).get('/api/appointments');

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(typeof res.body.error.message).toBe('string');
    });

    it('should return structured { error: { code, message } } on 404 Not Found', async () => {
      const res = await request(app).get('/api/route-does-not-exist');

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(typeof res.body.error.message).toBe('string');
    });
  });
});
