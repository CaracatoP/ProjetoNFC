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
let Product;
let Order;
let decryptSecret;
let mongoServer;
let primaryBusiness;
let secondaryBusiness;

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

describe('Client panel routes', () => {
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
    ({ Product } = await import('../models/Product.js'));
    ({ Order } = await import('../models/Order.js'));
    ({ decryptSecret } = await import('../utils/secretCrypto.js'));
    ({ default: app } = await import('../app.js'));

    await connectDatabase();
  });

  beforeEach(async () => {
    await seedDemoData({ reset: true });
    await ensureDefaultPlans();
    await User.deleteMany({});
    await Business.deleteMany({ slug: 'restaurante-vista-boa' });
    await Subscription.deleteMany({});

    primaryBusiness = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const premiumPlan = await Plan.findOne({ code: 'premium' });
    const proPlan = await Plan.findOne({ code: 'pro' });

    expect(primaryBusiness).toBeTruthy();
    expect(premiumPlan).toBeTruthy();
    expect(proPlan).toBeTruthy();

    secondaryBusiness = await Business.create({
      name: 'Restaurante Vista Boa',
      slug: 'restaurante-vista-boa',
      description: 'Tenant secundario para validar isolamento.',
      status: 'active',
      segment: 'restaurant',
      modules: {
        analytics: true,
        appointments: false,
        catalog: true,
        cart: true,
        orders: true,
        loyalty: false,
        whatsapp: true,
      },
      segmentConfig: {
        label: 'Restaurante',
      },
      address: {
        display: 'Rua das Flores, 55',
      },
      hours: [
        {
          id: 'weekday',
          label: 'Seg-Sex',
          value: '11:00 - 22:00',
        },
      ],
      contact: {
        whatsapp: '5511988887777',
        phone: '5511988887777',
        email: 'contato@vistaboa.local',
      },
      seo: {
        title: 'Restaurante Vista Boa',
        description: 'Tenant auxiliar para testes de permissao.',
        imageUrl: '',
      },
    });

    await Business.updateOne(
      { _id: primaryBusiness._id },
      {
        modules: {
          analytics: true,
          appointments: true,
          catalog: true,
          cart: true,
          orders: true,
          loyalty: true,
          whatsapp: true,
        },
      },
    );

    await Subscription.findOneAndUpdate(
      { businessId: primaryBusiness._id },
      {
        businessId: primaryBusiness._id,
        planId: premiumPlan._id,
        status: 'active',
        provider: 'internal',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await Subscription.findOneAndUpdate(
      { businessId: secondaryBusiness._id },
      {
        businessId: secondaryBusiness._id,
        planId: proPlan._id,
        status: 'active',
        provider: 'internal',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await User.insertMany([
      {
        name: 'Cliente Dono',
        email: 'owner@cliente.local',
        passwordHash: await hashPassword('owner123456'),
        roles: [],
        roleLevel: 2,
        businessId: primaryBusiness._id,
        status: 'active',
      },
      {
        name: 'Gerente',
        email: 'manager@cliente.local',
        passwordHash: await hashPassword('manager123456'),
        roles: [],
        roleLevel: 3,
        businessId: primaryBusiness._id,
        status: 'active',
      },
      {
        name: 'Operador',
        email: 'operator@cliente.local',
        passwordHash: await hashPassword('operator123456'),
        roles: [],
        roleLevel: 4,
        businessId: primaryBusiness._id,
        status: 'active',
      },
      {
        name: 'Visualizador',
        email: 'viewer@cliente.local',
        passwordHash: await hashPassword('viewer123456'),
        roles: [],
        roleLevel: 5,
        businessId: primaryBusiness._id,
        status: 'active',
      },
    ]);
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
  });

  async function login(email, password) {
    const response = await request(app).post('/api/auth/login').send({ email, password });
    expect(response.status).toBe(200);
    return response.body.data.token;
  }

  async function createOrderForPrimaryBusiness() {
    const existingProduct = await Product.findOne({ businessId: primaryBusiness._id }).lean();

    expect(existingProduct).toBeTruthy();

    const response = await request(app).post('/api/public/site/barbearia-estilo-vivo/orders').send({
      customerName: 'Cliente Teste',
      customerPhone: '11999999999',
      deliveryType: 'pickup',
      notes: 'Sem cebola',
      items: [
        {
          productId: String(existingProduct._id),
          name: existingProduct.name,
          quantity: 1,
          unitPrice: Number(existingProduct.price || 49.9),
          notes: '',
        },
      ],
    });

    expect(response.status).toBe(201);
    return response.body.data;
  }

  it('lets the tenant owner load the panel snapshot and update only basic settings', async () => {
    await Business.updateOne(
      { _id: primaryBusiness._id },
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

    const ownerToken = await login('owner@cliente.local', 'owner123456');

    const detailResponse = await request(app)
      .get('/api/panel/business')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.business.slug).toBe('barbearia-estilo-vivo');
    expect(detailResponse.body.data.modulesData).toBeTruthy();
    expect(detailResponse.body.data.business.contact.wifi).toEqual({
      ssid: '',
      password: '',
      security: 'WPA',
      title: '',
      description: '',
    });

    const updateResponse = await request(app)
      .put('/api/panel/business/basics')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        business: {
          name: 'Barbearia Cliente',
          slug: 'tentativa-de-mudar-slug',
          contact: {
            phone: '1130304040',
          },
        },
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.business.name).toBe('Barbearia Cliente');
    expect(updateResponse.body.data.business.contact.phone).toBe('1130304040');
    expect(updateResponse.body.data.business.slug).toBe('barbearia-estilo-vivo');
  });

  it('keeps Mercado Pago encrypted credentials out of the client panel payload', async () => {
    await Business.updateOne(
      { _id: primaryBusiness._id },
      {
        paymentSettings: {
          enabled: true,
          methods: {
            pix: true,
            creditCard: true,
            debitCard: true,
            cashOnPickup: true,
            cashOnDelivery: true,
          },
          provider: 'mercado_pago',
          mercadoPago: {
            enabled: true,
            publicKey: 'APP_USR-public-key',
            accessTokenEncrypted: 'v1:iv:tag:payload',
            webhookSecretEncrypted: 'v1:iv:tag:webhook',
            accountEmail: 'seller@example.com',
            connectedAt: new Date('2026-06-01T12:00:00.000Z'),
          },
        },
      },
    );

    const ownerToken = await login('owner@cliente.local', 'owner123456');
    const response = await request(app)
      .get('/api/panel/business')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.business.paymentSettings.mercadoPago).toEqual(
      expect.objectContaining({
        enabled: true,
        publicKey: 'APP_USR-public-key',
        accountEmail: 'seller@example.com',
        connected: true,
        hasAccessToken: true,
        hasWebhookSecret: true,
      }),
    );
    expect(response.body.data.business.paymentSettings.mercadoPago.accessTokenEncrypted).toBeUndefined();
    expect(response.body.data.business.paymentSettings.mercadoPago.webhookSecretEncrypted).toBeUndefined();
  });

  it('lets the tenant owner save Mercado Pago credentials without exposing secrets back to the client panel', async () => {
    const ownerToken = await login('owner@cliente.local', 'owner123456');

    const response = await request(app)
      .put('/api/panel/business/basics')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        business: {
          paymentSettings: {
            enabled: true,
            provider: 'mercado_pago',
            methods: {
              pix: true,
              creditCard: true,
              debitCard: true,
              cashOnPickup: true,
              cashOnDelivery: true,
            },
            mercadoPago: {
              enabled: true,
              publicKey: 'APP_USR-client-public',
              accessToken: 'CLIENT-ACCESS-TOKEN',
              webhookSecret: 'CLIENT-WEBHOOK-SECRET',
              accountEmail: 'seller@cliente.local',
            },
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.data.business.paymentSettings.mercadoPago).toEqual(
      expect.objectContaining({
        enabled: true,
        publicKey: 'APP_USR-client-public',
        accountEmail: 'seller@cliente.local',
        connected: true,
        hasAccessToken: true,
        hasWebhookSecret: true,
      }),
    );
    expect(response.body.data.business.paymentSettings.mercadoPago.accessToken).toBeUndefined();
    expect(response.body.data.business.paymentSettings.mercadoPago.webhookSecret).toBeUndefined();
    expect(response.body.data.business.paymentSettings.mercadoPago.accessTokenEncrypted).toBeUndefined();
    expect(response.body.data.business.paymentSettings.mercadoPago.webhookSecretEncrypted).toBeUndefined();

    const storedBusiness = await Business.findById(primaryBusiness._id).lean();
    expect(storedBusiness.paymentSettings.mercadoPago.accessTokenEncrypted).toMatch(/^v1:/);
    expect(storedBusiness.paymentSettings.mercadoPago.webhookSecretEncrypted).toMatch(/^v1:/);
    expect(decryptSecret(storedBusiness.paymentSettings.mercadoPago.accessTokenEncrypted)).toBe('CLIENT-ACCESS-TOKEN');
    expect(decryptSecret(storedBusiness.paymentSettings.mercadoPago.webhookSecretEncrypted)).toBe('CLIENT-WEBHOOK-SECRET');
  });

  it('preserves stored Mercado Pago credentials when the owner edits payment settings without resending the secrets', async () => {
    await Business.updateOne(
      { _id: primaryBusiness._id },
      {
        paymentSettings: {
          enabled: true,
          methods: {
            pix: true,
            creditCard: true,
            debitCard: true,
            cashOnPickup: true,
            cashOnDelivery: true,
          },
          provider: 'mercado_pago',
          mercadoPago: {
            enabled: true,
            publicKey: 'APP_USR-existing-public',
            accessTokenEncrypted: 'v1:existing:access:token',
            webhookSecretEncrypted: 'v1:existing:webhook:secret',
            accountEmail: 'existing@cliente.local',
          },
        },
      },
    );

    const seededBusiness = await Business.findById(primaryBusiness._id).lean();
    const encryptedAccessToken = seededBusiness.paymentSettings.mercadoPago.accessTokenEncrypted;
    const encryptedWebhookSecret = seededBusiness.paymentSettings.mercadoPago.webhookSecretEncrypted;
    const ownerToken = await login('owner@cliente.local', 'owner123456');

    const response = await request(app)
      .put('/api/panel/business/basics')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        business: {
          paymentSettings: {
            provider: 'mercado_pago',
            mercadoPago: {
              enabled: true,
              publicKey: 'APP_USR-updated-public',
              accountEmail: 'updated@cliente.local',
            },
          },
        },
      });

    expect(response.status).toBe(200);

    const storedBusiness = await Business.findById(primaryBusiness._id).lean();
    expect(storedBusiness.paymentSettings.mercadoPago.publicKey).toBe('APP_USR-updated-public');
    expect(storedBusiness.paymentSettings.mercadoPago.accountEmail).toBe('updated@cliente.local');
    expect(storedBusiness.paymentSettings.mercadoPago.accessTokenEncrypted).toBe(encryptedAccessToken);
    expect(storedBusiness.paymentSettings.mercadoPago.webhookSecretEncrypted).toBe(encryptedWebhookSecret);
  });

  it('lets the manager edit catalog items but blocks basic tenant settings', async () => {
    const managerToken = await login('manager@cliente.local', 'manager123456');

    const createProductResponse = await request(app)
      .post('/api/panel/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Pomada matte',
        description: 'Acabamento fosco',
        price: 39.9,
        image: '',
        category: 'Finalizacao',
        measurementUnit: 'unit',
        active: true,
      });

    expect(createProductResponse.status).toBe(201);
    expect(createProductResponse.body.data.name).toBe('Pomada matte');
    expect(createProductResponse.body.data.measurementUnit).toBe('unit');

    const basicsResponse = await request(app)
      .put('/api/panel/business/basics')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        business: {
          name: 'Nao deveria salvar',
        },
      });

    expect(basicsResponse.status).toBe(403);
    expect(basicsResponse.body.error.code).toBe('panel_business_basics_forbidden');
  });

  it('lets the operator update order status but blocks catalog mutations', async () => {
    const operatorToken = await login('operator@cliente.local', 'operator123456');
    const createdOrder = await createOrderForPrimaryBusiness();

    const listOrdersResponse = await request(app)
      .get('/api/panel/orders')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(listOrdersResponse.status).toBe(200);
    expect(listOrdersResponse.body.data.some((item) => item.id === createdOrder.id)).toBe(true);

    const updateOrderResponse = await request(app)
      .patch(`/api/panel/orders/${createdOrder.id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'ready' });

    expect(updateOrderResponse.status).toBe(200);
    expect(updateOrderResponse.body.data.status).toBe('ready');

    const createProductResponse = await request(app)
      .post('/api/panel/products')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        name: 'Nao permitido',
        description: '',
        price: 10,
        image: '',
        category: 'Teste',
        measurementUnit: 'unit',
        active: true,
      });

    expect(createProductResponse.status).toBe(403);
    expect(createProductResponse.body.error.code).toBe('panel_products_forbidden');
  });

  it('archives panel orders for the same tenant and hides them from normal listings', async () => {
    const ownerToken = await login('owner@cliente.local', 'owner123456');
    const createdOrder = await createOrderForPrimaryBusiness();

    const archiveResponse = await request(app)
      .delete(`/api/panel/orders/${createdOrder.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body.data.archived).toBe(true);
    expect(archiveResponse.body.data.id).toBe(createdOrder.id);

    const archivedRecord = await Order.findById(createdOrder.id).lean();
    expect(archivedRecord.archivedAt).toBeTruthy();

    const listOrdersResponse = await request(app)
      .get('/api/panel/orders')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(listOrdersResponse.status).toBe(200);
    expect(listOrdersResponse.body.data.some((item) => item.id === createdOrder.id)).toBe(false);
  });

  it('allows authorized client operators to mark manual tenant payments as paid', async () => {
    const ownerToken = await login('owner@cliente.local', 'owner123456');

    const product = await Product.findOne({ businessId: primaryBusiness._id }).lean();
    expect(product).toBeTruthy();

    await Business.updateOne(
      { _id: primaryBusiness._id },
      {
        paymentSettings: {
          enabled: true,
          methods: {
            pix: true,
            creditCard: false,
            debitCard: false,
            cashOnPickup: true,
            cashOnDelivery: true,
          },
          provider: 'manual',
        },
      },
    );

    const createOrderResponse = await request(app).post('/api/public/site/barbearia-estilo-vivo/orders').send({
      customerName: 'Cliente Pix',
      customerPhone: '11988887777',
      items: [
        {
          productId: String(product._id),
          name: product.name,
          quantity: 1,
          unitPrice: Number(product.price || 49.9),
        },
      ],
      payment: {
        method: 'pix',
      },
    });

    expect(createOrderResponse.status).toBe(201);

    const response = await request(app)
      .patch(`/api/panel/orders/${createOrderResponse.body.data.id}/payment-status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'paid' });

    expect(response.status).toBe(200);
    expect(response.body.data.payment).toEqual(
      expect.objectContaining({
        method: 'pix',
        status: 'paid',
        provider: 'manual',
      }),
    );
    expect(response.body.data.payment.paidAt).toEqual(expect.any(String));
  });

  it('fills order lifecycle timestamps on first status transition without overwriting prior marks', async () => {
    const operatorToken = await login('operator@cliente.local', 'operator123456');
    const createdOrder = await createOrderForPrimaryBusiness();

    expect(createdOrder.createdAt).toBeTruthy();
    expect(createdOrder.receivedAt).toBeTruthy();
    expect(createdOrder.preparingAt).toBeFalsy();
    expect(createdOrder.readyAt).toBeFalsy();
    expect(createdOrder.deliveredAt).toBeFalsy();
    expect(createdOrder.cancelledAt).toBeFalsy();

    const preparingResponse = await request(app)
      .patch(`/api/panel/orders/${createdOrder.id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'preparing' });

    expect(preparingResponse.status).toBe(200);
    expect(preparingResponse.body.data.status).toBe('preparing');
    expect(preparingResponse.body.data.preparingAt).toBeTruthy();

    const readyResponse = await request(app)
      .patch(`/api/panel/orders/${createdOrder.id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'ready' });

    expect(readyResponse.status).toBe(200);
    expect(readyResponse.body.data.readyAt).toBeTruthy();

    const deliveredResponse = await request(app)
      .patch(`/api/panel/orders/${createdOrder.id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'delivered' });

    expect(deliveredResponse.status).toBe(200);
    expect(deliveredResponse.body.data.deliveredAt).toBeTruthy();

    const deliveredAt = deliveredResponse.body.data.deliveredAt;
    const preparingAt = deliveredResponse.body.data.preparingAt;
    const readyAt = deliveredResponse.body.data.readyAt;

    const deliveredAgainResponse = await request(app)
      .patch(`/api/panel/orders/${createdOrder.id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'delivered' });

    expect(deliveredAgainResponse.status).toBe(200);
    expect(deliveredAgainResponse.body.data.deliveredAt).toBe(deliveredAt);
    expect(deliveredAgainResponse.body.data.preparingAt).toBe(preparingAt);
    expect(deliveredAgainResponse.body.data.readyAt).toBe(readyAt);
  });

  it('blocks cross-tenant order archive attempts from the client panel', async () => {
    const managerToken = await login('manager@cliente.local', 'manager123456');
    const foreignOrder = await Order.create({
      businessId: secondaryBusiness._id,
      customerName: 'Pedido estrangeiro',
      customerPhone: '11911111111',
      items: [
        {
          name: 'Produto do outro tenant',
          quantity: 1,
          unitPrice: 10,
          measurementUnit: 'unit',
          displayQuantity: '1 unidade',
          itemTotal: 10,
          notes: '',
        },
      ],
      total: 10,
      deliveryType: 'pickup',
      status: 'received',
      notes: '',
    });

    const response = await request(app)
      .delete(`/api/panel/orders/${String(foreignOrder._id)}`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('module_resource_not_found');
  });

  it('keeps the viewer read-only for orders while still allowing inspection', async () => {
    const viewerToken = await login('viewer@cliente.local', 'viewer123456');
    const createdOrder = await createOrderForPrimaryBusiness();

    const detailResponse = await request(app)
      .get('/api/panel/business')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.data.analytics).toBeUndefined();
    expect(detailResponse.body.data.history).toBeUndefined();
    expect(detailResponse.body.data.nfcTag).toBeUndefined();
    expect(detailResponse.body.data.business.contact).toEqual({});
    expect(detailResponse.body.data.modulesData.products).toBeInstanceOf(Array);
    expect(detailResponse.body.data.modulesData.orders).toBeInstanceOf(Array);
    expect(detailResponse.body.data.modulesData.appointmentRequests).toBeInstanceOf(Array);
    expect(detailResponse.body.data.modulesData.professionals).toEqual([]);
    expect(detailResponse.body.data.modulesData.appointmentServices).toEqual([]);

    const listOrdersResponse = await request(app)
      .get('/api/panel/orders')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(listOrdersResponse.status).toBe(200);
    expect(listOrdersResponse.body.data.some((item) => item.id === createdOrder.id)).toBe(true);

    const updateOrderResponse = await request(app)
      .patch(`/api/panel/orders/${createdOrder.id}/status`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ status: 'delivered' });

    expect(updateOrderResponse.status).toBe(403);
    expect(updateOrderResponse.body.error.code).toBe('panel_orders_forbidden');

    const archiveOrderResponse = await request(app)
      .delete(`/api/panel/orders/${createdOrder.id}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(archiveOrderResponse.status).toBe(403);
    expect(archiveOrderResponse.body.error.code).toBe('panel_orders_forbidden');

    const updatePaymentResponse = await request(app)
      .patch(`/api/panel/orders/${createdOrder.id}/payment-status`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ status: 'paid' });

    expect(updatePaymentResponse.status).toBe(403);
    expect(updatePaymentResponse.body.error.code).toBe('panel_orders_forbidden');

    const listProfessionalsResponse = await request(app)
      .get('/api/panel/professionals')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(listProfessionalsResponse.status).toBe(403);
    expect(listProfessionalsResponse.body.error.code).toBe('panel_professionals_forbidden');

    const listServicesResponse = await request(app)
      .get('/api/panel/appointment-services')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(listServicesResponse.status).toBe(403);
    expect(listServicesResponse.body.error.code).toBe('panel_services_forbidden');
  });

  it('blocks cross-tenant product access even without a business id in the request path', async () => {
    const managerToken = await login('manager@cliente.local', 'manager123456');
    const foreignProduct = await Product.create({
      businessId: secondaryBusiness._id,
      name: 'Produto do outro tenant',
      description: 'Nao pode vazar',
      price: 55,
      image: '',
      category: 'Teste',
      measurementUnit: 'unit',
      active: true,
    });

    const response = await request(app)
      .put(`/api/panel/products/${String(foreignProduct._id)}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Tentativa',
        description: 'Nao deve atualizar',
        price: 60,
        image: '',
        category: 'Teste',
        measurementUnit: 'unit',
        active: true,
      });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('module_resource_not_found');
  });

  it('blocks cross-tenant payment status mutations from the client panel', async () => {
    const managerToken = await login('manager@cliente.local', 'manager123456');
    const foreignOrder = await Order.create({
      businessId: secondaryBusiness._id,
      customerName: 'Pedido estrangeiro',
      customerPhone: '11911111111',
      items: [
        {
          name: 'Produto do outro tenant',
          quantity: 1,
          unitPrice: 10,
          measurementUnit: 'unit',
          displayQuantity: '1 unidade',
          itemTotal: 10,
          notes: '',
        },
      ],
      total: 10,
      deliveryType: 'pickup',
      status: 'received',
      payment: {
        method: 'cash_on_pickup',
        status: 'manual',
        provider: 'manual',
        amount: 10,
      },
      notes: '',
    });

    const response = await request(app)
      .patch(`/api/panel/orders/${String(foreignOrder._id)}/payment-status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'paid' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('module_resource_not_found');
  });

  it('rejects malformed resource identifiers before panel mutations reach the service layer', async () => {
    const managerToken = await login('manager@cliente.local', 'manager123456');

    const response = await request(app)
      .put('/api/panel/products/not-a-valid-object-id')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Tentativa',
        description: 'Nao deve validar',
        price: 60,
        image: '',
        category: 'Teste',
        active: true,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });

  it('keeps overdue clients logged in but blocks critical mutations and uploads', async () => {
    await Subscription.updateOne({ businessId: primaryBusiness._id }, { status: 'past_due' });
    const ownerToken = await login('owner@cliente.local', 'owner123456');

    const detailResponse = await request(app)
      .get('/api/panel/business')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(detailResponse.status).toBe(200);

    const createProductResponse = await request(app)
      .post('/api/panel/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Produto bloqueado',
        description: '',
        price: 22,
        image: '',
        category: 'Teste',
        measurementUnit: 'unit',
        active: true,
      });

    expect(createProductResponse.status).toBe(403);
    expect(createProductResponse.body.error.code).toBe('client_billing_restricted');

    const uploadResponse = await request(app)
      .post('/api/panel/uploads/image')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('tenantSlug', 'barbearia-estilo-vivo')
      .field('assetType', 'product')
      .attach('file', Buffer.from('fake-product-image'), {
        filename: 'product.png',
        contentType: 'image/png',
      });

    expect(uploadResponse.status).toBe(403);
    expect(uploadResponse.body.error.code).toBe('client_billing_restricted');
  });

  it('blocks suspended clients from loading the tenant panel', async () => {
    await Subscription.updateOne({ businessId: primaryBusiness._id }, { status: 'suspended' });
    const ownerToken = await login('owner@cliente.local', 'owner123456');

    const response = await request(app)
      .get('/api/panel/business')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(423);
    expect(response.body.error.code).toBe('client_access_suspended');
  });

  it('derives the upload folder from the authenticated tenant instead of trusting tenantSlug from the request', async () => {
    const ownerToken = await login('owner@cliente.local', 'owner123456');

    const response = await request(app)
      .post('/api/panel/uploads/image')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('tenantSlug', 'restaurante-vista-boa')
      .field('assetType', 'product')
      .attach('file', Buffer.from('fake-product-image'), {
        filename: 'product.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.folder).toBe('taplink/barbearia-estilo-vivo');
    expect(response.body.data.publicId).toContain('taplink/barbearia-estilo-vivo/product-demo');
  });

  it('rejects unsupported upload asset types on the client panel', async () => {
    const ownerToken = await login('owner@cliente.local', 'owner123456');

    const response = await request(app)
      .post('/api/panel/uploads/image')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('assetType', 'gallery')
      .attach('file', Buffer.from('fake-image'), {
        filename: 'product.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('panel_upload_asset_type_invalid');
  });

  it('rejects svg uploads on the client panel', async () => {
    const ownerToken = await login('owner@cliente.local', 'owner123456');

    const response = await request(app)
      .post('/api/panel/uploads/image')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('assetType', 'product')
      .attach('file', Buffer.from('<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>'), {
        filename: 'product.svg',
        contentType: 'image/svg+xml',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('upload_invalid_type');
  });

  it('resolves analytics scope by level and plan on the client panel', async () => {
    const managerToken = await login('manager@cliente.local', 'manager123456');
    const viewerToken = await login('viewer@cliente.local', 'viewer123456');

    const managerResponse = await request(app)
      .get('/api/panel/analytics')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(managerResponse.status).toBe(200);
    expect(managerResponse.body.data.scope).toBe('basic');

    const viewerResponse = await request(app)
      .get('/api/panel/analytics')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(viewerResponse.status).toBe(403);
    expect(viewerResponse.body.error.code).toBe('panel_analytics_forbidden');
  });

  it('ignores analytics events that happened before analyticsBaselineAt on the client panel', async () => {
    const ownerToken = await login('owner@cliente.local', 'owner123456');
    const baselineAt = new Date('2026-06-01T10:00:00.000Z');

    await Business.findByIdAndUpdate(primaryBusiness._id, { analyticsBaselineAt: baselineAt });

    await request(app).post('/api/public/analytics/events').send({
      slug: 'barbearia-estilo-vivo',
      eventType: 'page_view',
      targetType: 'page',
      targetLabel: 'Antes do baseline',
      occurredAt: '2026-05-31T23:00:00.000Z',
    });

    await request(app).post('/api/public/analytics/events').send({
      slug: 'barbearia-estilo-vivo',
      eventType: 'page_view',
      targetType: 'page',
      targetLabel: 'Depois do baseline',
      occurredAt: '2026-06-01T10:30:00.000Z',
    });

    const response = await request(app)
      .get('/api/panel/analytics')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.totals.totalEvents).toBe(1);
    expect(response.body.data.totals.pageViews).toBe(1);
  });

  it('rejects invalid measurement units on client panel product mutations', async () => {
    const managerToken = await login('manager@cliente.local', 'manager123456');

    const response = await request(app)
      .post('/api/panel/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Produto invalido',
        description: '',
        price: 19.9,
        image: '',
        category: 'Teste',
        measurementUnit: 'invalid-unit',
        active: true,
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });
});
