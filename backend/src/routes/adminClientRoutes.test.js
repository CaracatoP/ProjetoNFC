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
let superAdminToken;

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

describe('Admin client routes', () => {
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

    const loginResponse = await request(app).post('/api/admin/auth/login').send({
      username: 'admin@nfc.local',
      password: 'admin123456',
    });

    superAdminToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
  });

  async function createOperationalAdmin() {
    await User.create({
      name: 'Equipe Operacional',
      email: 'operacional@taplink.local',
      passwordHash: await hashPassword('operacional123'),
      roles: ['admin'],
      roleLevel: 1,
      status: 'active',
    });

    const loginResponse = await request(app).post('/api/admin/auth/login').send({
      email: 'operacional@taplink.local',
      password: 'operacional123',
    });

    return loginResponse.body.data.token;
  }

  async function createInternalAdminWithoutLegacyRoles() {
    await User.create({
      name: 'Equipe Operacional Moderna',
      email: 'operacional-sem-role@taplink.local',
      passwordHash: await hashPassword('operacional123'),
      roles: [],
      roleLevel: 1,
      status: 'active',
    });

    const loginResponse = await request(app).post('/api/admin/auth/login').send({
      email: 'operacional-sem-role@taplink.local',
      password: 'operacional123',
    });

    return loginResponse.body.data.token;
  }

  it('creates and lists client users with resolved tenant, plan and billing data', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' }).lean();

    const createResponse = await request(app)
      .post('/api/admin/clients')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Cliente Barbearia',
        email: 'cliente@barbearia.local',
        password: 'cliente123456',
        roleLevel: 2,
        businessId: String(business._id),
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.user.email).toBe('cliente@barbearia.local');
    expect(createResponse.body.data.user.roleLevel).toBe(2);
    expect(createResponse.body.data.business.slug).toBe('barbearia-estilo-vivo');
    expect(createResponse.body.data.subscription.status).toBe('paid');

    const listResponse = await request(app)
      .get('/api/admin/clients')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].user.email).toBe('cliente@barbearia.local');
  });

  it('treats client search text as a literal value instead of a raw regex pattern', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' }).lean();

    await request(app)
      .post('/api/admin/clients')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Cliente Barbearia',
        email: 'cliente-regex@barbearia.local',
        password: 'cliente123456',
        roleLevel: 2,
        businessId: String(business._id),
      });

    const response = await request(app)
      .get('/api/admin/clients')
      .query({ q: '.*' })
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });

  it('lets level 1 create and manage only client levels 2 to 5', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' }).lean();
    const levelOneToken = await createOperationalAdmin();

    const createResponse = await request(app)
      .post('/api/admin/clients')
      .set('Authorization', `Bearer ${levelOneToken}`)
      .send({
        name: 'Gerente da Loja',
        email: 'gerente@cliente.local',
        password: 'gerente123456',
        roleLevel: 3,
        businessId: String(business._id),
      });

    expect(createResponse.status).toBe(201);

    const clientId = createResponse.body.data.user.id;

    const updateLevelResponse = await request(app)
      .patch(`/api/admin/clients/${clientId}/access-level`)
      .set('Authorization', `Bearer ${levelOneToken}`)
      .send({ roleLevel: 4 });

    expect(updateLevelResponse.status).toBe(200);
    expect(updateLevelResponse.body.data.user.roleLevel).toBe(4);

    const resetPasswordResponse = await request(app)
      .patch(`/api/admin/clients/${clientId}/reset-password`)
      .set('Authorization', `Bearer ${levelOneToken}`)
      .send({ password: 'novaSenha123456' });

    expect(resetPasswordResponse.status).toBe(200);

    const blockedResponse = await request(app)
      .patch(`/api/admin/clients/${clientId}/block`)
      .set('Authorization', `Bearer ${levelOneToken}`);

    expect(blockedResponse.status).toBe(200);
    expect(blockedResponse.body.data.user.status).toBe('disabled');

    const unblockedResponse = await request(app)
      .patch(`/api/admin/clients/${clientId}/unblock`)
      .set('Authorization', `Bearer ${levelOneToken}`);

    expect(unblockedResponse.status).toBe(200);
    expect(unblockedResponse.body.data.user.status).toBe('active');
  });

  it('prevents level 1 from creating internal users or changing plan and billing', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' }).lean();
    const levelOneToken = await createOperationalAdmin();

    const forbiddenCreateResponse = await request(app)
      .post('/api/admin/clients')
      .set('Authorization', `Bearer ${levelOneToken}`)
      .send({
        name: 'Outro Admin',
        email: 'admin2@taplink.local',
        password: 'admin123456',
        roleLevel: 1,
        businessId: String(business._id),
      });

    expect(forbiddenCreateResponse.status).toBe(403);
    expect(forbiddenCreateResponse.body.error.code).toBe('client_role_forbidden');

    const createClientResponse = await request(app)
      .post('/api/admin/clients')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Cliente Loja',
        email: 'cliente2@taplink.local',
        password: 'cliente123456',
        roleLevel: 2,
        businessId: String(business._id),
      });

    const clientId = createClientResponse.body.data.user.id;

    const billingResponse = await request(app)
      .patch(`/api/admin/clients/${clientId}/billing-status`)
      .set('Authorization', `Bearer ${levelOneToken}`)
      .send({ billingStatus: 'overdue' });

    expect(billingResponse.status).toBe(403);
    expect(billingResponse.body.error.code).toBe('client_billing_forbidden');

    const planResponse = await request(app)
      .patch(`/api/admin/clients/${clientId}/plan`)
      .set('Authorization', `Bearer ${levelOneToken}`)
      .send({ planCode: 'premium' });

    expect(planResponse.status).toBe(403);
    expect(planResponse.body.error.code).toBe('client_plan_forbidden');
  });

  it('lets a level 1 user without legacy roles still manage client users by canonical roleLevel rules', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' }).lean();
    const levelOneToken = await createInternalAdminWithoutLegacyRoles();

    const createResponse = await request(app)
      .post('/api/admin/clients')
      .set('Authorization', `Bearer ${levelOneToken}`)
      .send({
        name: 'Cliente Canonico',
        email: 'canonico@cliente.local',
        password: 'cliente123456',
        roleLevel: 2,
        businessId: String(business._id),
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.user.roleLevel).toBe(2);
  });

  it('rejects malformed client identifiers before reaching the service layer', async () => {
    const response = await request(app)
      .get('/api/admin/clients/not-a-valid-object-id')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });

  it('lets level 0 change billing and plan on the linked tenant subscription', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' }).lean();
    const proPlan = await Plan.findOne({ code: 'pro' }).lean();

    const createResponse = await request(app)
      .post('/api/admin/clients')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Cliente Financeiro',
        email: 'financeiro@cliente.local',
        password: 'cliente123456',
        roleLevel: 2,
        businessId: String(business._id),
      });

    const clientId = createResponse.body.data.user.id;

    const planResponse = await request(app)
      .patch(`/api/admin/clients/${clientId}/plan`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ planCode: 'pro' });

    expect(planResponse.status).toBe(200);
    expect(planResponse.body.data.subscription.plan.code).toBe('pro');

    const billingResponse = await request(app)
      .patch(`/api/admin/clients/${clientId}/billing-status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ billingStatus: 'overdue' });

    expect(billingResponse.status).toBe(200);
    expect(billingResponse.body.data.subscription.status).toBe('overdue');

    const persistedSubscription = await Subscription.findOne({ businessId: business._id }).lean();

    expect(String(persistedSubscription.planId)).toBe(String(proPlan._id));
    expect(persistedSubscription.status).toBe('past_due');
  });
});
