import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let connectDatabase;
let disconnectDatabase;
let seedDemoData;
let mongoServer;
let adminToken;

describe('Admin routes', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.ENABLE_DEMO_SEED = 'true';
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    process.env.PUBLIC_SITE_BASE_URL = 'http://localhost:5173';
    process.env.API_PUBLIC_BASE_URL = 'http://localhost:4000';
    process.env.ADMIN_USERNAME = 'admin@nfc.local';
    process.env.ADMIN_PASSWORD = 'admin123456';
    process.env.ADMIN_TOKEN_SECRET = 'test-admin-secret';

    ({ connectDatabase, disconnectDatabase } = await import('../config/database.js'));
    ({ seedDemoData } = await import('../utils/seedDemoData.js'));
    ({ default: app } = await import('../app.js'));

    await connectDatabase();
  });

  beforeEach(async () => {
    await seedDemoData();
    const loginResponse = await request(app).post('/api/admin/auth/login').send({
      username: 'admin@nfc.local',
      password: 'admin123456',
    });
    adminToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
  });

  it('returns the current admin session', async () => {
    const response = await request(app)
      .get('/api/admin/auth/session')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.username).toBe('admin@nfc.local');
  });

  it('creates and lists businesses for the internal dashboard', async () => {
    const createResponse = await request(app)
      .post('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        business: {
          name: 'Restaurante Vista Boa',
          slug: 'restaurante-vista-boa',
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.business.slug).toBe('restaurante-vista-boa');

    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.some((item) => item.slug === 'restaurante-vista-boa')).toBe(true);
  });

  it('updates an existing business editor payload', async () => {
    const editorResponse = await request(app)
      .get('/api/admin/businesses/000000000000000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(editorResponse.status).toBe(404);

    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const targetId = listResponse.body.data[0].id;
    const detailResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const { business, theme, links, sections, nfcTag } = detailResponse.body.data;
    business.name = 'Barbearia Estilo Vivo Premium';

    const updateResponse = await request(app)
      .put(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ business, theme, links, sections, nfcTag });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.business.name).toBe('Barbearia Estilo Vivo Premium');
  });

  it('returns dashboard overview and accepts image uploads', async () => {
    const overviewResponse = await request(app)
      .get('/api/admin/dashboard/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(overviewResponse.status).toBe(200);
    expect(overviewResponse.body.data.totals.businesses).toBeGreaterThan(0);

    const uploadResponse = await request(app)
      .post('/api/admin/uploads/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('fake-image-content'), {
        filename: 'logo.png',
        contentType: 'image/png',
      });

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.data.url).toContain('/uploads/');
  });
});
