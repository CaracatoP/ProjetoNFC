import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { hashPassword } from '../utils/password.js';

let app;
let connectDatabase;
let disconnectDatabase;
let seedDemoData;
let AnalyticsEvent;
let Subscription;
let User;
let Business;
let BusinessTheme;
let Product;
let Professional;
let AppointmentService;
let AppointmentRequest;
let Order;
let subscribeToTenantUpdates;
let mongoServer;
let adminToken;

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
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';

    ({ connectDatabase, disconnectDatabase } = await import('../config/database.js'));
    ({ seedDemoData } = await import('../utils/seedDemoData.js'));
    ({ AnalyticsEvent } = await import('../models/AnalyticsEvent.js'));
    ({ Subscription } = await import('../models/Subscription.js'));
    ({ User } = await import('../models/User.js'));
    ({ Business } = await import('../models/Business.js'));
    ({ BusinessTheme } = await import('../models/BusinessTheme.js'));
    ({ Product } = await import('../models/Product.js'));
    ({ Professional } = await import('../models/Professional.js'));
    ({ AppointmentService } = await import('../models/AppointmentService.js'));
    ({ AppointmentRequest } = await import('../models/AppointmentRequest.js'));
    ({ Order } = await import('../models/Order.js'));
    ({ subscribeToTenantUpdates } = await import('../services/tenantRealtimeService.js'));
    ({ default: app } = await import('../app.js'));

    await connectDatabase();
  });

  beforeEach(async () => {
    await seedDemoData({ reset: true });
    await User.deleteMany({});
    const loginResponse = await request(app).post('/api/admin/auth/login').send({
      username: 'admin@nfc.local',
      password: 'admin123456',
    });
    adminToken = loginResponse.body.data.token;
  });

  async function createInternalAdminWithoutLegacyRoles() {
    await User.create({
      name: 'Equipe Operacional Moderna',
      email: 'ops-modern@taplink.local',
      passwordHash: await hashPassword('opsmodern123'),
      roles: [],
      roleLevel: 1,
      status: 'active',
    });

    const loginResponse = await request(app).post('/api/admin/auth/login').send({
      email: 'ops-modern@taplink.local',
      password: 'opsmodern123',
    });

    expect(loginResponse.status).toBe(200);
    return loginResponse.body.data.token;
  }

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

  it('issues a short-lived preview token for a tenant selected in the admin workspace', async () => {
    const targetBusiness = await Business.findOne({ slug: 'barbearia-estilo-vivo' }).lean();

    const response = await request(app)
      .post(`/api/admin/businesses/${targetBusiness._id.toString()}/preview-token`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        token: expect.any(String),
        expiresAt: expect.any(String),
        businessId: targetBusiness._id.toString(),
        slug: 'barbearia-estilo-vivo',
      }),
    );
  });

  it('protects admin routes when the bearer token is missing', async () => {
    const response = await request(app).get('/api/admin/businesses');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('admin_unauthorized');
  });

  it('bootstraps the admin user in the database and rejects invalid credentials', async () => {
    const persistedAdmin = await User.findOne({ email: 'admin@nfc.local' }).lean();

    expect(persistedAdmin).toBeTruthy();
    expect(persistedAdmin.roles).toContain('superadmin');
    expect(persistedAdmin.roleLevel).toBe(0);
    expect(persistedAdmin.bootstrapManaged).toBe(true);
    expect(persistedAdmin.passwordHash).toBeTruthy();

    const invalidLoginResponse = await request(app).post('/api/admin/auth/login').send({
      username: 'admin@nfc.local',
      password: 'senha-errada',
    });

    expect(invalidLoginResponse.status).toBe(401);
    expect(invalidLoginResponse.body.error.code).toBe('admin_invalid_credentials');
  });

  it('normalizes the bootstrap admin to level 0 when a legacy record already exists', async () => {
    await User.deleteMany({});
    const passwordHash = await hashPassword('admin123456');

    await User.collection.insertOne({
      name: 'Operacao TapLink',
      email: 'admin@nfc.local',
      passwordHash,
      roles: ['superadmin'],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const loginResponse = await request(app).post('/api/admin/auth/login').send({
      username: 'admin@nfc.local',
      password: 'admin123456',
    });

    expect(loginResponse.status).toBe(200);

    const persistedAdmin = await User.findOne({ email: 'admin@nfc.local' }).lean();

    expect(persistedAdmin).toBeTruthy();
    expect(persistedAdmin.roles).toContain('superadmin');
    expect(persistedAdmin.roleLevel).toBe(0);
    expect(persistedAdmin.bootstrapManaged).toBe(true);
  });

  it('normalizes legacy internal admin users without roleLevel to level 1', async () => {
    await User.collection.insertOne({
      name: 'Equipe Operacional',
      email: 'ops@nfc.local',
      passwordHash: await hashPassword('ops123456'),
      roles: ['admin'],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const loginResponse = await request(app).post('/api/admin/auth/login').send({
      username: 'admin@nfc.local',
      password: 'admin123456',
    });

    expect(loginResponse.status).toBe(200);

    const persistedInternalAdmin = await User.findOne({ email: 'ops@nfc.local' }).lean();

    expect(persistedInternalAdmin).toBeTruthy();
    expect(persistedInternalAdmin.roleLevel).toBe(1);
    expect(persistedInternalAdmin.bootstrapManaged).not.toBe(true);
  });

  it('does not promote a user without internal markers to level 0', async () => {
    await User.collection.insertOne({
      name: 'Cliente Sem Marcador',
      email: 'cliente@nfc.local',
      passwordHash: await hashPassword('cliente123456'),
      roles: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const loginResponse = await request(app).post('/api/admin/auth/login').send({
      username: 'admin@nfc.local',
      password: 'admin123456',
    });

    expect(loginResponse.status).toBe(200);

    const nonInternalUser = await User.findOne({ email: 'cliente@nfc.local' }).lean();

    expect(nonInternalUser).toBeTruthy();
    expect(nonInternalUser.roleLevel).toBeUndefined();
    expect(nonInternalUser.bootstrapManaged).not.toBe(true);
  });

  it('fails clearly when bootstrap email points to a non-internal user', async () => {
    await User.deleteMany({});

    await User.collection.insertOne({
      name: 'Conta Errada',
      email: 'admin@nfc.local',
      passwordHash: await hashPassword('admin123456'),
      roles: [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const loginResponse = await request(app).post('/api/admin/auth/login').send({
      username: 'admin@nfc.local',
      password: 'admin123456',
    });

    expect(loginResponse.status).toBe(500);
    expect(loginResponse.body.error.code).toBe('admin_bootstrap_conflict');

    const persistedUser = await User.findOne({ email: 'admin@nfc.local' }).lean();

    expect(persistedUser).toBeTruthy();
    expect(persistedUser.roleLevel).toBeUndefined();
  });

  it('rejects login for disabled admin users', async () => {
    await User.updateOne({ email: 'admin@nfc.local' }, { status: 'disabled' });

    const response = await request(app).post('/api/admin/auth/login').send({
      email: 'admin@nfc.local',
      password: 'admin123456',
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('admin_user_disabled');
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
    expect(createResponse.body.data.business.status).toBe('active');

    const subscription = await Subscription.findOne({
      businessId: createResponse.body.data.business.id,
    }).lean();

    const publicResponse = await request(app).get('/api/public/site/restaurante-vista-boa');

    expect(subscription).toBeTruthy();
    expect(subscription.status).toBe('active');
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.data.business.slug).toBe('restaurante-vista-boa');

    const detailResponse = await request(app)
      .get(`/api/admin/businesses/${createResponse.body.data.business.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.sections.find((section) => section.key === 'services')?.description).toBe('');
    expect(detailResponse.body.data.sections.find((section) => section.key === 'contact')?.description).toBe('');
    expect(detailResponse.body.data.analytics.timeline).toBeInstanceOf(Array);
    expect(detailResponse.body.data.analytics.topLinks).toBeInstanceOf(Array);
    expect(detailResponse.body.data.analytics.topShortcuts).toBeInstanceOf(Array);

    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.some((item) => item.slug === 'restaurante-vista-boa')).toBe(true);
  });

  it('falls back to a default v2 theme when a tenant has no persisted theme record', async () => {
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const targetId = listResponse.body.data[0].id;
    await BusinessTheme.deleteMany({ businessId: targetId });

    const detailResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const publicResponse = await request(app).get(`/api/public/site/${listResponse.body.data[0].slug}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.theme.raw.version).toBe(2);
    expect(detailResponse.body.data.theme.raw.backgroundColor).toBe('#111111');
    expect(detailResponse.body.data.theme.raw.cardColor).toBe('#1d1d1d');

    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.data.theme.raw.version).toBe(2);
    expect(publicResponse.body.data.theme.raw.backgroundColor).toBe('#111111');
  });

  it('returns a clear conflict when trying to create a tenant with duplicate slug', async () => {
    const response = await request(app)
      .post('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        business: {
          name: 'Barbearia Clone',
          slug: 'barbearia-estilo-vivo',
        },
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('business_slug_conflict');
    expect(response.body.error.details?.[0]?.path).toBe('business.slug');
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
    expect(updateResponse.body.data.history.some((entry) => entry.field === 'business.name')).toBe(true);
  });

  it('allows canonical level 1 admins without legacy roles to run non-sensitive business mutations', async () => {
    const levelOneToken = await createInternalAdminWithoutLegacyRoles();
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${levelOneToken}`);

    const targetBusiness = listResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');

    const response = await request(app)
      .patch(`/api/admin/businesses/${targetBusiness.id}/status`)
      .set('Authorization', `Bearer ${levelOneToken}`)
      .send({ status: 'inactive' });

    expect(response.status).toBe(200);
    expect(response.body.data.business.status).toBe('inactive');
  });

  it('rejects malformed business identifiers before loading the admin editor', async () => {
    const response = await request(app)
      .get('/api/admin/businesses/not-a-valid-object-id')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });

  it('rejects saving a duplicated tenant through the original route and keeps the original slug untouched', async () => {
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const originalBusiness = listResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');
    const originalId = originalBusiness.id;
    const originalDetailResponse = await request(app)
      .get(`/api/admin/businesses/${originalId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const duplicatePayload = {
      business: {
        ...originalDetailResponse.body.data.business,
        name: 'Barbearia Estilo Vivo Copy',
        slug: 'barbearia-estilo-vivo-copy',
        domains: {
          subdomain: '',
          customDomain: '',
        },
      },
      theme: originalDetailResponse.body.data.theme,
      links: originalDetailResponse.body.data.links,
      sections: originalDetailResponse.body.data.sections,
      nfcTag: {
        ...(originalDetailResponse.body.data.nfcTag || {}),
        code: '',
      },
    };

    const createDuplicateResponse = await request(app)
      .post('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(duplicatePayload);

    expect(createDuplicateResponse.status).toBe(201);
    const duplicateId = createDuplicateResponse.body.data.business.id;

    const duplicatedEditorPayload = {
      business: {
        ...createDuplicateResponse.body.data.business,
        id: duplicateId,
        slug: 'barbearia-estilo-vivo-copy-editado',
      },
      theme: createDuplicateResponse.body.data.theme,
      links: createDuplicateResponse.body.data.links,
      sections: createDuplicateResponse.body.data.sections,
      nfcTag: createDuplicateResponse.body.data.nfcTag,
    };

    const mismatchResponse = await request(app)
      .put(`/api/admin/businesses/${originalId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(duplicatedEditorPayload);

    expect(mismatchResponse.status).toBe(409);
    expect(mismatchResponse.body.error.code).toBe('business_id_mismatch');

    const originalAfterMismatchResponse = await request(app)
      .get(`/api/admin/businesses/${originalId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(originalAfterMismatchResponse.status).toBe(200);
    expect(originalAfterMismatchResponse.body.data.business.slug).toBe('barbearia-estilo-vivo');

    const validDuplicateUpdateResponse = await request(app)
      .put(`/api/admin/businesses/${duplicateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(duplicatedEditorPayload);

    expect(validDuplicateUpdateResponse.status).toBe(200);
    expect(validDuplicateUpdateResponse.body.data.business.slug).toBe('barbearia-estilo-vivo-copy-editado');

    const originalFinalResponse = await request(app)
      .get(`/api/admin/businesses/${originalId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(originalFinalResponse.status).toBe(200);
    expect(originalFinalResponse.body.data.business.slug).toBe('barbearia-estilo-vivo');
  });

  it('normalizes legacy tenants without wifi before returning admin and public payloads', async () => {
    const originalBusiness = await Business.findOne({ slug: 'barbearia-estilo-vivo' }).lean();

    await Business.updateOne(
      { _id: originalBusiness._id },
      {
        $unset: {
          'contact.wifi': 1,
        },
      },
    );

    const adminDetailResponse = await request(app)
      .get(`/api/admin/businesses/${originalBusiness._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const publicDetailResponse = await request(app).get('/api/public/site/barbearia-estilo-vivo');

    expect(adminDetailResponse.status).toBe(200);
    expect(adminDetailResponse.body.data.business.contact.wifi).toEqual({
      ssid: '',
      password: '',
      security: 'WPA',
      title: '',
      description: '',
    });

    expect(publicDetailResponse.status).toBe(200);
    expect(publicDetailResponse.body.data.business.contact.wifi).toEqual({
      ssid: '',
      password: '',
      security: 'WPA',
      title: '',
      description: '',
    });
  });

  it('normalizes duplicated tenant wifi defaults and keeps duplicate contact edits isolated from the original', async () => {
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const originalBusiness = listResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');
    const originalId = originalBusiness.id;

    await Business.updateOne(
      { _id: originalId },
      {
        $set: {
          'contact.wifi.security': 'WPA',
        },
        $unset: {
          'contact.wifi.ssid': 1,
          'contact.wifi.password': 1,
          'contact.wifi.title': 1,
          'contact.wifi.description': 1,
        },
      },
    );

    const originalDetailResponse = await request(app)
      .get(`/api/admin/businesses/${originalId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(originalDetailResponse.status).toBe(200);
    expect(originalDetailResponse.body.data.business.contact.wifi).toEqual({
      ssid: '',
      password: '',
      security: 'WPA',
      title: '',
      description: '',
    });

    const createDuplicateResponse = await request(app)
      .post('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        business: {
          ...originalDetailResponse.body.data.business,
          name: 'Barbearia Estilo Vivo Copy Wifi',
          slug: 'barbearia-estilo-vivo-copy-wifi',
          domains: {
            subdomain: '',
            customDomain: '',
          },
        },
        theme: originalDetailResponse.body.data.theme,
        links: originalDetailResponse.body.data.links,
        sections: originalDetailResponse.body.data.sections,
        nfcTag: {
          ...(originalDetailResponse.body.data.nfcTag || {}),
          code: '',
        },
      });

    expect(createDuplicateResponse.status).toBe(201);
    expect(createDuplicateResponse.body.data.business.contact.wifi).toEqual({
      ssid: '',
      password: '',
      security: 'WPA',
      title: '',
      description: '',
    });

    const duplicateId = createDuplicateResponse.body.data.business.id;

    const duplicatePublicResponse = await request(app).get('/api/public/site/barbearia-estilo-vivo-copy-wifi');

    expect(duplicatePublicResponse.status).toBe(200);
    expect(duplicatePublicResponse.body.data.business.contact.wifi).toEqual({
      ssid: '',
      password: '',
      security: 'WPA',
      title: '',
      description: '',
    });

    const duplicateUpdateResponse = await request(app)
      .put(`/api/admin/businesses/${duplicateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        business: {
          ...createDuplicateResponse.body.data.business,
          id: duplicateId,
          contact: {
            ...createDuplicateResponse.body.data.business.contact,
            wifi: {
              ...(createDuplicateResponse.body.data.business.contact.wifi || {}),
              ssid: 'WiFi Copy',
              password: 'senha-copy',
              security: 'WPA2',
            },
          },
        },
        theme: createDuplicateResponse.body.data.theme,
        links: createDuplicateResponse.body.data.links,
        sections: createDuplicateResponse.body.data.sections,
        nfcTag: createDuplicateResponse.body.data.nfcTag,
      });

    expect(duplicateUpdateResponse.status).toBe(200);

    const originalAfterDuplicateEditResponse = await request(app)
      .get(`/api/admin/businesses/${originalId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(originalAfterDuplicateEditResponse.status).toBe(200);
    expect(originalAfterDuplicateEditResponse.body.data.business.contact.wifi).toEqual({
      ssid: '',
      password: '',
      security: 'WPA',
      title: '',
      description: '',
    });
  });

  it('toggles the tenant status and blocks public rendering while inactive', async () => {
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const targetBusiness = listResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');
    const targetId = targetBusiness.id;

    const deactivateResponse = await request(app)
      .patch(`/api/admin/businesses/${targetId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });

    expect(deactivateResponse.status).toBe(200);
    expect(deactivateResponse.body.data.business.status).toBe('inactive');
    expect(deactivateResponse.body.data.history.some((entry) => entry.field === 'business.status')).toBe(true);

    const publicWhileInactive = await request(app).get('/api/public/site/barbearia-estilo-vivo');

    expect(publicWhileInactive.status).toBe(423);
    expect(publicWhileInactive.body.error.code).toBe('business_inactive');

    const reactivateResponse = await request(app)
      .patch(`/api/admin/businesses/${targetId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });

    expect(reactivateResponse.status).toBe(200);
    expect(reactivateResponse.body.data.business.status).toBe('active');
  });

  it('sanitizes blank editor fields during update instead of rejecting the payload', async () => {
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const targetBusiness = listResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');
    const targetId = targetBusiness.id;
    const detailResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const { business, theme, links, sections, nfcTag } = detailResponse.body.data;
    business.hours[0].value = '';
    business.seo.title = '';
    business.seo.description = '';
    business.address.latitude = '';
    business.address.longitude = '';

    const updateResponse = await request(app)
      .put(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ business, theme, links, sections, nfcTag });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.business.seo.title).toBe('Barbearia Estilo Vivo | Pagina NFC');
    expect(updateResponse.body.data.business.seo.description).toContain('Barbearia tradicional');
    expect(updateResponse.body.data.business.hours.some((item) => item.id === 'weekday')).toBe(false);
    expect(updateResponse.body.data.business.address).not.toHaveProperty('latitude');
    expect(updateResponse.body.data.business.address).not.toHaveProperty('longitude');
  });

  it('normalizes a human-readable slug during update', async () => {
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const targetBusiness = listResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');
    const targetId = targetBusiness.id;
    const detailResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const { business, theme, links, sections, nfcTag } = detailResponse.body.data;
    business.slug = 'Barbearia São João 2026';

    const updateResponse = await request(app)
      .put(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ business, theme, links, sections, nfcTag });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.business.slug).toBe('barbearia-sao-joao-2026');
  });

  it('accepts a partial v2 theme payload and persists canonical hex values with safe defaults', async () => {
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const targetBusiness = listResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');
    const targetId = targetBusiness.id;
    const detailResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const { business, links, sections, nfcTag } = detailResponse.body.data;

    const updateResponse = await request(app)
      .put(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        business,
        links,
        sections,
        nfcTag,
        theme: {
          version: 2,
          backgroundColor: 'FFF',
          primaryButtonColor: 'C8A46A',
        },
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.theme.raw.version).toBe(2);
    expect(updateResponse.body.data.theme.raw.backgroundColor).toBe('#ffffff');
    expect(updateResponse.body.data.theme.raw.primaryButtonColor).toBe('#c8a46a');
    expect(updateResponse.body.data.theme.raw.cardColor).toBe('#1d1d1d');
    expect(updateResponse.body.data.theme.raw.textColor).toBe('#f5f5f5');
  });

  it('applies the segment preset on tenant creation and keeps modules editable later', async () => {
    const createResponse = await request(app)
      .post('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        business: {
          name: 'Clinica Prisma',
          slug: 'clinica-prisma',
          segment: 'clinic',
        },
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.business.segment).toBe('clinic');
    expect(createResponse.body.data.business.modules).toMatchObject({
      appointments: true,
      whatsapp: true,
      catalog: false,
      cart: false,
      orders: false,
      loyalty: false,
      analytics: false,
    });
    expect(createResponse.body.data.business.segmentConfig.label).toBe('Clinica');

    const detailResponse = await request(app)
      .get(`/api/admin/businesses/${createResponse.body.data.business.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const { business, theme, links, sections, nfcTag } = detailResponse.body.data;
    business.modules.analytics = true;
    business.modules.catalog = true;

    const updateResponse = await request(app)
      .put(`/api/admin/businesses/${business.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ business, theme, links, sections, nfcTag });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.business.modules.analytics).toBe(true);
    expect(updateResponse.body.data.business.modules.catalog).toBe(true);
    expect(updateResponse.body.data.business.segment).toBe('clinic');
  });

  it('returns a compatible default segment/modules state for legacy tenants without saved values', async () => {
    const legacyInsert = await Business.collection.insertOne({
      name: 'Tenant legado',
      slug: 'tenant-legado',
      status: 'active',
      seo: {
        title: 'Tenant legado',
        description: 'Tenant sem dados de segmento persistidos.',
      },
    });
    await Business.collection.updateOne(
      { _id: legacyInsert.insertedId },
      {
        $unset: {
          segment: '',
          modules: '',
          segmentConfig: '',
        },
      },
    );

    const detailResponse = await request(app)
      .get(`/api/admin/businesses/${legacyInsert.insertedId.toString()}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.business.segment).toBe('other');
    expect(detailResponse.body.data.business.modules).toMatchObject({
      catalog: true,
      whatsapp: true,
      appointments: false,
      cart: false,
      orders: false,
      loyalty: false,
      analytics: false,
    });
    expect(detailResponse.body.data.business.segmentConfig.label).toBe('Outro');
  });

  it('creates and updates appointment module records scoped to the tenant', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTenantUpdates({ slug: 'barbearia-estilo-vivo' }, listener);
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const targetBusiness = listResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');
    const targetId = targetBusiness.id;

    const avatarUploadResponse = await request(app)
      .post('/api/admin/uploads/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('tenantSlug', 'barbearia-estilo-vivo')
      .field('assetType', 'professional')
      .attach('file', Buffer.from('fake-professional-image'), {
        filename: 'professional.png',
        contentType: 'image/png',
      });

    const professionalResponse = await request(app)
      .post(`/api/admin/businesses/${targetId}/professionals`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Rafael Cortez',
        role: 'Barbeiro senior',
        avatar: avatarUploadResponse.body.data.url,
        active: true,
      });

    expect(professionalResponse.status).toBe(201);
    expect(professionalResponse.body.data.name).toBe('Rafael Cortez');
    expect(professionalResponse.body.data.avatar).toContain('res.cloudinary.com');

    const appointmentServiceResponse = await request(app)
      .post(`/api/admin/businesses/${targetId}/appointment-services`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Corte + barba',
        price: 75,
        durationMinutes: 60,
        description: 'Atendimento completo',
        active: true,
      });

    expect(appointmentServiceResponse.status).toBe(201);
    expect(appointmentServiceResponse.body.data.durationMinutes).toBe(60);

    const listProfessionalsResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}/professionals`)
      .set('Authorization', `Bearer ${adminToken}`);
    const listServicesResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}/appointment-services`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listProfessionalsResponse.status).toBe(200);
    expect(listProfessionalsResponse.body.data.some((item) => item.name === 'Rafael Cortez')).toBe(true);
    expect(listServicesResponse.status).toBe(200);
    expect(listServicesResponse.body.data.some((item) => item.name === 'Corte + barba')).toBe(true);

    const updateProfessionalResponse = await request(app)
      .put(`/api/admin/businesses/${targetId}/professionals/${professionalResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Rafael Cortez',
        role: 'Especialista em degradê',
        avatar: avatarUploadResponse.body.data.url,
        active: true,
      });

    expect(updateProfessionalResponse.status).toBe(200);
    expect(updateProfessionalResponse.body.data.role).toBe('Especialista em degradê');

    const updateServiceResponse = await request(app)
      .put(`/api/admin/businesses/${targetId}/appointment-services/${appointmentServiceResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Corte + barba premium',
        price: 85,
        durationMinutes: 70,
        description: 'Atendimento premium',
        active: true,
      });

    expect(updateServiceResponse.status).toBe(200);
    expect(updateServiceResponse.body.data.price).toBe(85);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'professional_created' }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'appointment_service_created' }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'professional_updated' }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'appointment_service_updated' }));

    expect(await Professional.countDocuments({ businessId: targetId })).toBeGreaterThan(0);
    expect(await AppointmentService.countDocuments({ businessId: targetId })).toBeGreaterThan(0);
    unsubscribe();
  });

  it('creates and updates product/order records scoped to the tenant', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTenantUpdates({ slug: 'barbearia-estilo-vivo' }, listener);
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const targetBusiness = listResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');
    const targetId = targetBusiness.id;
    const productImageUploadResponse = await request(app)
      .post('/api/admin/uploads/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('tenantSlug', 'barbearia-estilo-vivo')
      .field('assetType', 'product')
      .attach('file', Buffer.from('fake-product-image'), {
        filename: 'product.png',
        contentType: 'image/png',
      });

    const createProductResponse = await request(app)
      .post(`/api/admin/businesses/${targetId}/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Pomada modeladora',
        description: 'Acabamento fosco',
        price: 39.9,
        image: productImageUploadResponse.body.data.url,
        category: 'Finalizacao',
        active: true,
      });

    expect(createProductResponse.status).toBe(201);
    expect(createProductResponse.body.data.name).toBe('Pomada modeladora');
    expect(createProductResponse.body.data.image).toContain('res.cloudinary.com');

    const listProductsResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}/products`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listProductsResponse.status).toBe(200);
    expect(listProductsResponse.body.data.some((item) => item.name === 'Pomada modeladora')).toBe(true);

    const updateProductResponse = await request(app)
      .put(`/api/admin/businesses/${targetId}/products/${createProductResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Pomada modeladora premium',
        description: 'Acabamento fosco premium',
        price: 44.9,
        image: productImageUploadResponse.body.data.url,
        category: 'Finalizacao',
        active: true,
      });

    expect(updateProductResponse.status).toBe(200);
    expect(updateProductResponse.body.data.price).toBe(44.9);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'product_created' }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'product_updated' }));
    expect(await Product.countDocuments({ businessId: targetId })).toBeGreaterThan(0);
    unsubscribe();
  });

  it('lists and updates inbound appointment requests and orders from the admin side', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTenantUpdates({ slug: 'barbearia-estilo-vivo' }, listener);
    const appointmentRequestResponse = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/appointment-requests')
      .send({
        professionalName: 'Equipe principal',
        serviceName: 'Corte masculino',
        customerName: 'Carlos',
        customerPhone: '5511999999999',
        requestedDate: '2026-06-10',
        requestedTime: '14:00',
        notes: 'Preferencia por navalha',
      });

    const orderResponse = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
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
        notes: 'Retirar as 18h',
      });

    expect(appointmentRequestResponse.status).toBe(201);
    expect(orderResponse.status).toBe(201);

    const businessListResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);
    const targetBusiness = businessListResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');
    const targetId = targetBusiness.id;

    const listAppointmentsResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}/appointment-requests`)
      .set('Authorization', `Bearer ${adminToken}`);
    const listOrdersResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}/orders`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listAppointmentsResponse.status).toBe(200);
    expect(listAppointmentsResponse.body.data[0].status).toBe('pending');
    expect(listOrdersResponse.status).toBe(200);
    expect(listOrdersResponse.body.data[0].status).toBe('received');

    const updateAppointmentStatusResponse = await request(app)
      .patch(`/api/admin/businesses/${targetId}/appointment-requests/${listAppointmentsResponse.body.data[0].id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' });
    const updateOrderStatusResponse = await request(app)
      .patch(`/api/admin/businesses/${targetId}/orders/${listOrdersResponse.body.data[0].id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'preparing' });

    expect(updateAppointmentStatusResponse.status).toBe(200);
    expect(updateAppointmentStatusResponse.body.data.status).toBe('confirmed');
    expect(updateOrderStatusResponse.status).toBe(200);
    expect(updateOrderStatusResponse.body.data.status).toBe('preparing');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'appointment_created' }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'order_created' }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'appointment_status_updated' }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ kind: 'order_status_updated' }));

    expect(await AppointmentRequest.countDocuments({ businessId: targetId })).toBeGreaterThan(0);
    expect(await Order.countDocuments({ businessId: targetId })).toBeGreaterThan(0);
    unsubscribe();
  });

  it('rejects scoped module mutations when the resource belongs to another tenant', async () => {
    const primaryBusiness = (await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`)).body.data.find((item) => item.slug === 'barbearia-estilo-vivo');

    const secondaryBusinessResponse = await request(app)
      .post('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        business: {
          name: 'Mercado do Bairro',
          slug: 'mercado-do-bairro',
          description: 'Segundo tenant para teste de escopo.',
          status: 'active',
          segment: 'market',
          modules: {
            catalog: true,
            appointments: false,
            cart: true,
            orders: true,
            loyalty: false,
            whatsapp: true,
            analytics: false,
          },
          seo: {
            title: 'Mercado do Bairro',
            description: 'Teste de escopo multi-tenant.',
          },
        },
        theme: {},
        links: [],
        sections: [],
        nfcTag: null,
      });

    expect(secondaryBusinessResponse.status).toBe(201);

    const productResponse = await request(app)
      .post(`/api/admin/businesses/${primaryBusiness.id}/products`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Navalha premium',
        description: 'Acessorio da barbearia',
        price: 89.9,
        image: 'https://cdn.example.com/products/navalha.png',
        category: 'Acessorios',
        active: true,
      });

    expect(productResponse.status).toBe(201);

    const wrongScopeUpdateResponse = await request(app)
      .put(`/api/admin/businesses/${secondaryBusinessResponse.body.data.business.id}/products/${productResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Navalha premium',
        description: 'Nao deveria atualizar em outro tenant',
        price: 91.9,
        image: 'https://cdn.example.com/products/navalha.png',
        category: 'Acessorios',
        active: true,
      });

    expect(wrongScopeUpdateResponse.status).toBe(404);
    expect(wrongScopeUpdateResponse.body.error.code).toBe('module_resource_not_found');
  });

  it('keeps duplicate tenant theme isolated from the original after later edits', async () => {
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const originalBusiness = listResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');
    const originalId = originalBusiness.id;
    const originalDetailResponse = await request(app)
      .get(`/api/admin/businesses/${originalId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const createDuplicateResponse = await request(app)
      .post('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        business: {
          ...originalDetailResponse.body.data.business,
          name: 'Barbearia Estilo Vivo Copy Theme',
          slug: 'barbearia-estilo-vivo-copy-theme',
          domains: {
            subdomain: '',
            customDomain: '',
          },
        },
        theme: originalDetailResponse.body.data.theme,
        links: originalDetailResponse.body.data.links,
        sections: originalDetailResponse.body.data.sections,
        nfcTag: {
          ...(originalDetailResponse.body.data.nfcTag || {}),
          code: '',
        },
      });

    const duplicateId = createDuplicateResponse.body.data.business.id;

    const duplicateUpdateResponse = await request(app)
      .put(`/api/admin/businesses/${duplicateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        business: {
          ...createDuplicateResponse.body.data.business,
          id: duplicateId,
        },
        theme: {
          ...createDuplicateResponse.body.data.theme.raw,
          backgroundColor: '#ffffff',
          primaryButtonColor: '#111111',
        },
        links: createDuplicateResponse.body.data.links,
        sections: createDuplicateResponse.body.data.sections,
        nfcTag: createDuplicateResponse.body.data.nfcTag,
      });

    const originalAfterDuplicateEditResponse = await request(app)
      .get(`/api/admin/businesses/${originalId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(duplicateUpdateResponse.status).toBe(200);
    expect(duplicateUpdateResponse.body.data.theme.raw.backgroundColor).toBe('#ffffff');
    expect(duplicateUpdateResponse.body.data.theme.raw.primaryButtonColor).toBe('#111111');

    expect(originalAfterDuplicateEditResponse.status).toBe(200);
    expect(originalAfterDuplicateEditResponse.body.data.theme.raw.backgroundColor).not.toBe('#ffffff');
    expect(originalAfterDuplicateEditResponse.body.data.theme.raw.primaryButtonColor).not.toBe('#111111');
  });

  it('reflects admin-managed business fields on the public site and keeps them after a normal demo seed boot', async () => {
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const targetBusiness = listResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');
    const targetId = targetBusiness.id;
    const detailResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const { business, theme, links, sections, nfcTag } = detailResponse.body.data;
    business.badge = 'Agenda premium';
    business.logoUrl = 'https://cdn.example.com/logo-novo.png';
    business.logoPublicId = 'taplink/barbearia-estilo-vivo/logo-demo';
    business.bannerUrl = 'https://cdn.example.com/banner-novo.png';
    business.bannerPublicId = 'taplink/barbearia-estilo-vivo/banner-demo';
    business.description = 'Descricao atualizada pelo painel.';
    business.contact.email = 'contato@estilovivo.com';
    business.contact.wifi = {
      ...(business.contact.wifi || {}),
      ssid: 'Estilo Vivo Guest',
      password: 'Senha123',
      security: 'WPA',
    };
    business.seo.imageUrl = 'https://cdn.example.com/favicon-novo.png';
    business.seo.imagePublicId = 'taplink/barbearia-estilo-vivo/site-icon-demo';
    links.push({
      type: 'social',
      group: 'primary',
      label: 'Instagram',
      subtitle: 'Acompanhe novidades',
      icon: 'instagram',
      url: 'https://instagram.com/estilovivo',
      visible: true,
      order: 999,
      target: '_blank',
      metadata: {},
    });

    const updateResponse = await request(app)
      .put(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ business, theme, links, sections, nfcTag });

    expect(updateResponse.status).toBe(200);

    const publicResponse = await request(app).get('/api/public/site/barbearia-estilo-vivo');

    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.data.business.badge).toBe('Agenda premium');
    expect(publicResponse.body.data.seo.imageUrl).toBe('https://cdn.example.com/favicon-novo.png');
    const heroSection = publicResponse.body.data.sections.find((section) => section.key === 'hero-main');
    expect(heroSection.description).toBe('Descricao atualizada pelo painel.');
    expect(heroSection.settings.logoUrl).toBe('https://cdn.example.com/logo-novo.png');
    expect(heroSection.settings.bannerUrl).toBe('https://cdn.example.com/banner-novo.png');
    const quickActions = publicResponse.body.data.sections.find((section) => section.key === 'quick-actions');
    expect(quickActions.items.some((item) => item.url === 'mailto:contato@estilovivo.com')).toBe(true);
    expect(quickActions.items.some((item) => item.type === 'wifi')).toBe(true);
    expect(quickActions.items.some((item) => item.url === 'https://instagram.com/estilovivo')).toBe(true);

    await seedDemoData();

    const afterSeedResponse = await request(app).get('/api/public/site/barbearia-estilo-vivo');

    expect(afterSeedResponse.status).toBe(200);
    expect(afterSeedResponse.body.data.business.badge).toBe('Agenda premium');
    expect(afterSeedResponse.body.data.business.logoUrl).toBe('https://cdn.example.com/logo-novo.png');

    const persistedEditorResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(persistedEditorResponse.status).toBe(200);
    expect(persistedEditorResponse.body.data.business.logoPublicId).toBe('taplink/barbearia-estilo-vivo/logo-demo');
    expect(persistedEditorResponse.body.data.business.bannerPublicId).toBe('taplink/barbearia-estilo-vivo/banner-demo');
    expect(persistedEditorResponse.body.data.business.seo.imagePublicId).toBe('taplink/barbearia-estilo-vivo/site-icon-demo');
  });

  it('keeps removed quick actions deleted after saving and refreshing the tenant', async () => {
    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    const targetBusiness = listResponse.body.data.find((item) => item.slug === 'barbearia-estilo-vivo');
    const targetId = targetBusiness.id;
    const detailResponse = await request(app)
      .get(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const { business, theme, links, sections, nfcTag } = detailResponse.body.data;
    const nextLinks = links.filter((link) => link.metadata?.action !== 'whatsapp');
    const nextSections = sections.map((section) =>
      section.key === 'quick-actions'
        ? {
            ...section,
            settings: {
              ...(section.settings || {}),
              hiddenActions: ['whatsapp'],
            },
          }
        : section,
    );

    const updateResponse = await request(app)
      .put(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ business, theme, links: nextLinks, sections: nextSections, nfcTag });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.business.contact.whatsapp).toBe('5511998765432');
    expect(updateResponse.body.data.links.some((link) => link.metadata?.action === 'whatsapp')).toBe(false);

    const refreshedEditor = await request(app)
      .get(`/api/admin/businesses/${targetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(refreshedEditor.status).toBe(200);
    expect(refreshedEditor.body.data.links.some((link) => link.metadata?.action === 'whatsapp')).toBe(false);

    const publicResponse = await request(app).get('/api/public/site/barbearia-estilo-vivo');
    const quickActions = publicResponse.body.data.sections.find((section) => section.key === 'quick-actions');

    expect(publicResponse.status).toBe(200);
    expect(quickActions.items.some((item) => item.metadata?.action === 'whatsapp')).toBe(false);
    expect(quickActions.items.some((item) => String(item.url || '').startsWith('https://wa.me/'))).toBe(false);
  });

  it('returns dashboard overview and accepts image uploads', async () => {
    await request(app).post('/api/public/analytics/events').send({
      slug: 'barbearia-estilo-vivo',
      eventType: 'page_view',
      targetType: 'page',
      targetLabel: 'Barbearia Estilo Vivo',
    });
    await request(app).post('/api/public/analytics/events').send({
      slug: 'barbearia-estilo-vivo',
      eventType: 'link_click',
      targetType: 'whatsapp',
      targetLabel: 'WhatsApp',
    });

    const overviewResponse = await request(app)
      .get('/api/admin/dashboard/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(overviewResponse.status).toBe(200);
    expect(overviewResponse.body.data.totals.businesses).toBeGreaterThan(0);
    expect(overviewResponse.body.data.analytics.highlights.pageViews).toBeGreaterThanOrEqual(1);
    expect(overviewResponse.body.data.analytics.highlights.linkClicks).toBeGreaterThanOrEqual(1);
    expect(overviewResponse.body.data.analytics.timeline).toBeInstanceOf(Array);
    expect(overviewResponse.body.data.analytics.topShortcuts.some((item) => item.targetType === 'whatsapp')).toBe(true);
    expect(overviewResponse.body.data.analytics.devices).toBeInstanceOf(Array);
    expect(overviewResponse.body.data.analytics.browsers).toBeInstanceOf(Array);

    const uploadResponse = await request(app)
      .post('/api/admin/uploads/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('tenantSlug', 'barbearia-estilo-vivo')
      .field('assetType', 'banner')
      .attach('file', Buffer.from('fake-image-content'), {
        filename: 'logo.png',
        contentType: 'image/png',
      });

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.data.url).toContain('res.cloudinary.com');
    expect(uploadResponse.body.data.publicId).toBe('taplink/barbearia-estilo-vivo/banner-demo');
    expect(uploadResponse.headers['x-powered-by']).toBeUndefined();
  });

  it('resets analytics by baseline for level 0 without deleting historical events', async () => {
    const historicalCountBefore = await AnalyticsEvent.countDocuments();

    await request(app).post('/api/public/analytics/events').send({
      slug: 'barbearia-estilo-vivo',
      eventType: 'page_view',
      targetType: 'page',
      targetLabel: 'Historico antigo',
      occurredAt: '2026-05-01T10:00:00.000Z',
    });

    const storedBeforeReset = await AnalyticsEvent.countDocuments();
    expect(storedBeforeReset).toBe(historicalCountBefore + 1);

    const resetResponse = await request(app)
      .post('/api/admin/dashboard/analytics/reset')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.data.scope).toBe('global');
    expect(resetResponse.body.data.baselineAt).toEqual(expect.any(String));
    expect(resetResponse.body.data.updatedBusinesses).toBeGreaterThan(0);
    expect(await AnalyticsEvent.countDocuments()).toBe(storedBeforeReset);

    await request(app).post('/api/public/analytics/events').send({
      slug: 'barbearia-estilo-vivo',
      eventType: 'page_view',
      targetType: 'page',
      targetLabel: 'Evento apos reset',
    });

    const overviewResponse = await request(app)
      .get('/api/admin/dashboard/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(overviewResponse.status).toBe(200);
    expect(overviewResponse.body.data.analytics.highlights.pageViews).toBe(1);
    expect(overviewResponse.body.data.analytics.highlights.totalEvents).toBe(1);
  });

  it('blocks analytics baseline reset for level 1 admins', async () => {
    const levelOneToken = await createInternalAdminWithoutLegacyRoles();

    const response = await request(app)
      .post('/api/admin/dashboard/analytics/reset')
      .set('Authorization', `Bearer ${levelOneToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('analytics_reset_forbidden');
  });

  it('rejects non-image files on the admin upload route', async () => {
    const response = await request(app)
      .post('/api/admin/uploads/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('tenantSlug', 'barbearia-estilo-vivo')
      .field('assetType', 'banner')
      .attach('file', Buffer.from('nao-e-imagem'), {
        filename: 'arquivo.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('upload_invalid_type');
  });

  it('rejects svg uploads on the admin upload route', async () => {
    const response = await request(app)
      .post('/api/admin/uploads/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('tenantSlug', 'barbearia-estilo-vivo')
      .field('assetType', 'banner')
      .attach('file', Buffer.from('<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>'), {
        filename: 'arquivo.svg',
        contentType: 'image/svg+xml',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('upload_invalid_type');
  });

  it('rejects uploads with unsafe extensions even when the mime type looks like an image', async () => {
    const response = await request(app)
      .post('/api/admin/uploads/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('tenantSlug', 'barbearia-estilo-vivo')
      .field('assetType', 'banner')
      .attach('file', Buffer.from('fake-image-content'), {
        filename: 'arquivo.txt',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('upload_invalid_type');
  });

  it('rejects unsupported admin upload asset types before reaching Cloudinary', async () => {
    const response = await request(app)
      .post('/api/admin/uploads/image')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('tenantSlug', 'barbearia-estilo-vivo')
      .field('assetType', 'script')
      .attach('file', Buffer.from('fake-image-content'), {
        filename: 'logo.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });
});
