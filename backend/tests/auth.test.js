const request = require('supertest');
const app = require('../src/app');

describe('Auth Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should return 422 when phone is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test User', password: 'password123' });

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should return 422 when password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ phone: '08012345678', name: 'Test', password: '123' });

      expect(res.statusCode).toBe(422);
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
});
