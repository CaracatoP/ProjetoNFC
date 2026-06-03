import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let connectDatabase;
let disconnectDatabase;
let seedDemoData;
let AnalyticsEvent;
let mongoServer;

describe('Public route hardening', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.ENABLE_DEMO_SEED = 'true';
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    process.env.PUBLIC_SITE_BASE_URL = 'http://localhost:5173';
    process.env.PUBLIC_FORM_RATE_LIMIT_MAX = '2';
    process.env.PUBLIC_FORM_RATE_LIMIT_WINDOW_MS = '60000';
    process.env.PUBLIC_ANALYTICS_RATE_LIMIT_MAX = '1';
    process.env.PUBLIC_ANALYTICS_RATE_LIMIT_WINDOW_MS = '60000';

    ({ connectDatabase, disconnectDatabase } = await import('../config/database.js'));
    ({ seedDemoData } = await import('../utils/seedDemoData.js'));
    ({ AnalyticsEvent } = await import('../models/AnalyticsEvent.js'));
    ({ default: app } = await import('../app.js'));

    await connectDatabase();
  });

  beforeEach(async () => {
    await seedDemoData({ reset: true });
    await AnalyticsEvent.deleteMany({});
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
  });

  it('rate limits repeated public appointment requests', async () => {
    const payload = {
      professionalName: 'Equipe principal',
      serviceName: 'Corte masculino',
      customerName: 'Carlos',
      customerPhone: '5511999999999',
      requestedDate: '2026-06-10',
      requestedTime: '14:00',
      notes: 'Preferencia por navalha',
    };

    const firstResponse = await request(app).post('/api/public/site/barbearia-estilo-vivo/appointment-requests').send(payload);
    const secondResponse = await request(app).post('/api/public/site/barbearia-estilo-vivo/appointment-requests').send(payload);
    const thirdResponse = await request(app).post('/api/public/site/barbearia-estilo-vivo/appointment-requests').send(payload);

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(thirdResponse.status).toBe(429);
    expect(thirdResponse.body.error.code).toBe('public_form_rate_limited');
  });

  it('rate limits repeated public order submissions', async () => {
    const payload = {
      customerName: 'Carlos',
      customerPhone: '5511999999999',
      items: [
        {
          name: 'Pomada modeladora',
          quantity: 2,
          unitPrice: 39.9,
          notes: '',
        },
      ],
      deliveryType: 'pickup',
      payment: {
        method: 'cash_on_pickup',
      },
      notes: 'Retirar as 18h',
    };

    const firstResponse = await request(app).post('/api/public/site/barbearia-estilo-vivo/orders').send(payload);
    const secondResponse = await request(app).post('/api/public/site/barbearia-estilo-vivo/orders').send(payload);
    const thirdResponse = await request(app).post('/api/public/site/barbearia-estilo-vivo/orders').send(payload);

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(thirdResponse.status).toBe(429);
    expect(thirdResponse.body.error.code).toBe('public_form_rate_limited');
  });

  it('rate limits repeated public analytics writes', async () => {
    const payload = {
      slug: 'barbearia-estilo-vivo',
      eventType: 'page_view',
      sectionType: 'hero',
      targetType: 'page',
    };

    const firstResponse = await request(app).post('/api/public/analytics/events').send(payload);
    const secondResponse = await request(app).post('/api/public/analytics/events').send(payload);

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(429);
    expect(secondResponse.body.error.code).toBe('public_analytics_rate_limited');
  });
});
