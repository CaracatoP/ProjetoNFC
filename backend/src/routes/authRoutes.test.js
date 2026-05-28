import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { hashPassword } from '../utils/password.js';

let app;
let connectDatabase;
let disconnectDatabase;
let seedDemoData;
let ensureDefaultPlans;
let User;
let Business;
let Plan;
let Subscription;
let mongoServer;
let clientToken;

vi.mock('../utils/cloudinaryUpload.js', () => ({
  buildTenantAssetFolder: vi.fn((tenantSlug = 'default') => `taplink/${tenantSlug || 'default'}`),
  uploadImageBufferToCloudinary: vi.fn(async (_file, options = {}) => ({
    secure_url: `https://res.cloudinary.com/demo/image/upload/v1/${options.folder || 'taplink/default'}/${options.assetType || 'image'}.png`,
    public_id: `${options.folder || 'taplink/default'}/${options.assetType || 'image'}-demo`,
    bytes: 2048,
    width: 1200,
    height: 630,
    format: 'png',
  })),
  destroyCloudinaryAsset: vi.fn(),
}));

describe('Unified auth routes', () => {
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
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';

    ({ connectDatabase, disconnectDatabase } = await import('../config/database.js'));
    ({ seedDemoData } = await import('../utils/seedDemoData.js'));
    ({ ensureDefaultPlans } = await import('../services/billingService.js'));
    ({ User } = await import('../models/User.js'));
    ({ Business } = await import('../models/Business.js'));
    ({ Plan } = await import('../models/Plan.js'));
    ({ Subscription } = await import('../models/Subscription.js'));
    ({ default: app } = await import('../app.js'));

    await connectDatabase();
  });

  beforeEach(async () => {
    await seedDemoData({ reset: true });
    await ensureDefaultPlans();
    await User.deleteMany({});

    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const premiumPlan = await Plan.findOne({ code: 'premium' });

    expect(business).toBeTruthy();
    expect(premiumPlan).toBeTruthy();

    await Business.updateOne(
      { _id: business._id },
      {
        modules: {
          analytics: true,
          appointments: true,
          catalog: true,
          cart: false,
          orders: true,
          loyalty: true,
          whatsapp: true,
        },
      },
    );

    await Subscription.findOneAndUpdate(
      { businessId: business._id },
      {
        businessId: business._id,
        planId: premiumPlan._id,
        status: 'active',
        provider: 'internal',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await User.create({
      name: 'Cliente Barbearia',
      email: 'cliente@barbearia.local',
      passwordHash: await hashPassword('cliente123456'),
      roles: [],
      roleLevel: 2,
      businessId: business._id,
      status: 'active',
    });

    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'cliente@barbearia.local',
      password: 'cliente123456',
    });

    clientToken = loginResponse.body?.data?.token || '';
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
  });

  it('logs in a tenant client through the unified auth route with resolved access context', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'cliente@barbearia.local',
      password: 'cliente123456',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toBeTruthy();
    expect(response.body.data.user.email).toBe('cliente@barbearia.local');
    expect(response.body.data.user.roleLevel).toBe(2);
    expect(response.body.data.business.slug).toBe('barbearia-estilo-vivo');
    expect(response.body.data.access.billingStatus).toBe('paid');
    expect(response.body.data.access.analyticsScope).toBe('advanced');
    expect(response.body.data.access.capabilities.canEditCatalog).toBe(true);
  });

  it('returns the current unified session with tenant, plan and billing data', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${clientToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe('cliente@barbearia.local');
    expect(response.body.data.subscription.plan.code).toBe('premium');
    expect(response.body.data.access.analyticsScope).toBe('advanced');
  });

  it('keeps logout stateless for unified sessions', async () => {
    const response = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${clientToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.loggedOut).toBe(true);
  });

  it('rejects invalid credentials on the unified login route', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'cliente@barbearia.local',
      password: 'senha-errada',
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('session_invalid_credentials');
  });

  it('prevents tenant clients from authenticating through the legacy admin login route', async () => {
    const response = await request(app).post('/api/admin/auth/login').send({
      email: 'cliente@barbearia.local',
      password: 'cliente123456',
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('admin_forbidden');
  });
});
