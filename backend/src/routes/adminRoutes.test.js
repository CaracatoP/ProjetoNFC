import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let connectDatabase;
let disconnectDatabase;
let seedDemoData;
let Subscription;
let User;
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
    ({ Subscription } = await import('../models/Subscription.js'));
    ({ User } = await import('../models/User.js'));
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

  it('protects admin routes when the bearer token is missing', async () => {
    const response = await request(app).get('/api/admin/businesses');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('admin_unauthorized');
  });

  it('bootstraps the admin user in the database and rejects invalid credentials', async () => {
    const persistedAdmin = await User.findOne({ email: 'admin@nfc.local' }).lean();

    expect(persistedAdmin).toBeTruthy();
    expect(persistedAdmin.roles).toContain('superadmin');
    expect(persistedAdmin.passwordHash).toBeTruthy();

    const invalidLoginResponse = await request(app).post('/api/admin/auth/login').send({
      username: 'admin@nfc.local',
      password: 'senha-errada',
    });

    expect(invalidLoginResponse.status).toBe(401);
    expect(invalidLoginResponse.body.error.code).toBe('admin_invalid_credentials');
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

    const listResponse = await request(app)
      .get('/api/admin/businesses')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.some((item) => item.slug === 'restaurante-vista-boa')).toBe(true);
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
    const overviewResponse = await request(app)
      .get('/api/admin/dashboard/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(overviewResponse.status).toBe(200);
    expect(overviewResponse.body.data.totals.businesses).toBeGreaterThan(0);

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
});
