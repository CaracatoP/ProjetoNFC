import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let connectDatabase;
let disconnectDatabase;
let seedDemoData;
let AnalyticsEvent;
let Business;
let mongoServer;

describe('Public routes', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.ENABLE_DEMO_SEED = 'true';
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    process.env.PUBLIC_SITE_BASE_URL = 'http://localhost:5173';

    ({ connectDatabase, disconnectDatabase } = await import('../config/database.js'));
    ({ seedDemoData } = await import('../utils/seedDemoData.js'));
    ({ AnalyticsEvent } = await import('../models/AnalyticsEvent.js'));
    ({ Business } = await import('../models/Business.js'));
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

  it('returns the public site payload for a valid slug', async () => {
    const response = await request(app).get('/api/public/site/barbearia-estilo-vivo');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.business.slug).toBe('barbearia-estilo-vivo');
    expect(response.body.data.sections[0].type).toBe('hero');
    expect(response.body.data.sections.some((section) => section.type === 'pix')).toBe(true);
  });

  it('returns 404 when the slug does not exist', async () => {
    const response = await request(app).get('/api/public/site/inexistente');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('business_not_found');
  });

  it('returns a neutral blocked response when the tenant is inactive', async () => {
    await Business.findOneAndUpdate({ slug: 'barbearia-estilo-vivo' }, { status: 'inactive' });

    const response = await request(app).get('/api/public/site/barbearia-estilo-vivo');

    expect(response.status).toBe(423);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('business_inactive');
  });

  it('allows public access for a draft tenant slug', async () => {
    await Business.findOneAndUpdate({ slug: 'barbearia-estilo-vivo' }, { status: 'draft' });

    const response = await request(app).get('/api/public/site/barbearia-estilo-vivo');

    expect(response.status).toBe(200);
    expect(response.body.data.business.slug).toBe('barbearia-estilo-vivo');
    expect(response.body.data.business.status).toBe('draft');
  });

  it('resolves the tenant by configured subdomain host', async () => {
    await Business.findOneAndUpdate(
      { slug: 'barbearia-estilo-vivo' },
      { domains: { subdomain: 'estilo-vivo', customDomain: '' } },
    );

    const response = await request(app).get('/api/public/site').query({ host: 'estilo-vivo.tenant.local' });

    expect(response.status).toBe(200);
    expect(response.body.data.business.slug).toBe('barbearia-estilo-vivo');
    expect(response.body.meta.resolvedBy).toBe('host');
  });

  it('resolves the tenant by configured custom domain host', async () => {
    await Business.findOneAndUpdate(
      { slug: 'barbearia-estilo-vivo' },
      { domains: { subdomain: '', customDomain: 'cliente-estilo-vivo.com.br' } },
    );

    const response = await request(app).get('/api/public/site').query({ host: 'cliente-estilo-vivo.com.br' });

    expect(response.status).toBe(200);
    expect(response.body.data.business.slug).toBe('barbearia-estilo-vivo');
    expect(response.body.meta.resolvedBy).toBe('host');
  });

  it('resolves an NFC tag to a business site', async () => {
    const response = await request(app).get('/api/public/tags/NFC-BARB-001/resolve');

    expect(response.status).toBe(200);
    expect(response.body.data.slug).toBe('barbearia-estilo-vivo');
    expect(response.body.data.siteUrl).toContain('/site/barbearia-estilo-vivo');
  });

  it('resolves an NFC tag for a draft tenant', async () => {
    await Business.findOneAndUpdate({ slug: 'barbearia-estilo-vivo' }, { status: 'draft' });

    const response = await request(app).get('/api/public/tags/NFC-BARB-001/resolve');

    expect(response.status).toBe(200);
    expect(response.body.data.slug).toBe('barbearia-estilo-vivo');
  });

  it('blocks NFC resolution when the tenant is inactive', async () => {
    await Business.findOneAndUpdate({ slug: 'barbearia-estilo-vivo' }, { status: 'inactive' });

    const response = await request(app).get('/api/public/tags/NFC-BARB-001/resolve');

    expect(response.status).toBe(423);
    expect(response.body.error.code).toBe('business_inactive');
  });

  it('records analytics events with validation', async () => {
    const response = await request(app).post('/api/public/analytics/events').send({
      slug: 'barbearia-estilo-vivo',
      eventType: 'page_view',
      sectionType: 'hero',
      targetType: 'page',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.recorded).toBe(true);
    expect(await AnalyticsEvent.countDocuments()).toBe(1);
  });

  it('rejects invalid analytics payloads', async () => {
    const response = await request(app).post('/api/public/analytics/events').send({
      slug: 'barbearia-estilo-vivo',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });
});
