const request = require('supertest');
const app = require('../src/app');

describe('Auth Endpoints', () => {
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

  describe('GET /api/clinic-info', () => {
    it('should return hospital and clinic details publicly', async () => {
      const res = await request(app).get('/api/clinic-info');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hospitalName).toBeDefined();
      expect(res.body.data.emergencyUnitNumber).toBeDefined();
      expect(res.body.data.googleMapsUrl).toBeDefined();
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
