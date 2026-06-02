import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mercadoPagoServiceMock = vi.hoisted(() => ({
  createMercadoPagoCheckoutPreference: vi.fn(),
}));
const asaasServiceMock = vi.hoisted(() => ({
  createAsaasCustomer: vi.fn(),
  createAsaasPaymentCharge: vi.fn(),
  getAsaasPixQrCode: vi.fn(),
}));

vi.mock('../services/mercadoPagoService.js', () => ({
  createMercadoPagoCheckoutPreference: mercadoPagoServiceMock.createMercadoPagoCheckoutPreference,
}));
vi.mock('../services/asaasService.js', async () => {
  const actual = await vi.importActual('../services/asaasService.js');

  return {
    ...actual,
    createAsaasCustomer: asaasServiceMock.createAsaasCustomer,
    createAsaasPaymentCharge: asaasServiceMock.createAsaasPaymentCharge,
    getAsaasPixQrCode: asaasServiceMock.getAsaasPixQrCode,
  };
});

let app;
let connectDatabase;
let disconnectDatabase;
let seedDemoData;
let AnalyticsEvent;
let Business;
let BusinessSection;
let Professional;
let AppointmentService;
let Product;
let SystemSetting;
let subscribeToTenantUpdates;
let env;
let mongoServer;
let adminToken;

describe('Public routes', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.ENABLE_DEMO_SEED = 'true';
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
    process.env.PUBLIC_SITE_BASE_URL = 'http://localhost:5173';
    process.env.ADMIN_USERNAME = 'admin@nfc.local';
    process.env.ADMIN_PASSWORD = 'admin123456';
    process.env.ADMIN_TOKEN_SECRET = 'test-admin-secret';
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX = '100';

    ({ connectDatabase, disconnectDatabase } = await import('../config/database.js'));
    ({ seedDemoData } = await import('../utils/seedDemoData.js'));
    ({ AnalyticsEvent } = await import('../models/AnalyticsEvent.js'));
    ({ Business } = await import('../models/Business.js'));
    ({ BusinessSection } = await import('../models/BusinessSection.js'));
    ({ Professional } = await import('../models/Professional.js'));
    ({ AppointmentService } = await import('../models/AppointmentService.js'));
    ({ Product } = await import('../models/Product.js'));
    ({ SystemSetting } = await import('../models/SystemSetting.js'));
    ({ subscribeToTenantUpdates } = await import('../services/tenantRealtimeService.js'));
    ({ env } = await import('../config/env.js'));
    ({ default: app } = await import('../app.js'));

    await connectDatabase();
  });

  beforeEach(async () => {
    await seedDemoData({ reset: true });
    await AnalyticsEvent.deleteMany({});
    await SystemSetting.deleteMany({});
    mercadoPagoServiceMock.createMercadoPagoCheckoutPreference.mockReset();
    asaasServiceMock.createAsaasCustomer.mockReset();
    asaasServiceMock.createAsaasPaymentCharge.mockReset();
    asaasServiceMock.getAsaasPixQrCode.mockReset();
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

  it('returns the public site payload for a valid slug', async () => {
    const response = await request(app).get('/api/public/site/barbearia-estilo-vivo');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=120');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.body.success).toBe(true);
    expect(response.body.data.business.slug).toBe('barbearia-estilo-vivo');
    expect(response.body.data.sections[0].type).toBe('hero');
    expect(response.body.data.sections.some((section) => section.type === 'pix')).toBe(true);
  });

  it('does not expose encrypted Mercado Pago credentials on the public site payload', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });

    await Business.updateOne(
      { _id: business._id },
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
          },
        },
      },
    );

    const response = await request(app).get('/api/public/site/barbearia-estilo-vivo');

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

  it('keeps the public site route working when preview tokens are not configured', async () => {
    const previousPreviewTokenSecret = env.previewTokenSecret;
    env.previewTokenSecret = '';

    try {
      const response = await request(app).get('/api/public/site/barbearia-estilo-vivo');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.business.slug).toBe('barbearia-estilo-vivo');
    } finally {
      env.previewTokenSecret = previousPreviewTokenSecret;
    }
  });

  it('requires a valid preview token before bypassing cache for preview public requests by slug', async () => {
    const previewRequestedResponse = await request(app)
      .get('/api/public/site/barbearia-estilo-vivo')
      .query({ preview: '1', t: '1700000000000' });

    expect(previewRequestedResponse.status).toBe(200);
    expect(previewRequestedResponse.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=120');
    expect(previewRequestedResponse.body.meta.previewAuthorized).toBe(false);

    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' }).lean();
    const previewTokenResponse = await request(app)
      .post(`/api/admin/businesses/${business._id.toString()}/preview-token`)
      .set('Authorization', `Bearer ${adminToken}`);

    const previewResponse = await request(app)
      .get('/api/public/site/barbearia-estilo-vivo')
      .query({
        preview: '1',
        t: '1700000000000',
        previewToken: previewTokenResponse.body.data.token,
      });

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.headers['cache-control']).toBe('no-store');
    expect(previewResponse.body.meta.previewAuthorized).toBe(true);
  });

  it('normalizes the public section copy for legacy seeded tenants', async () => {
    const response = await request(app).get('/api/public/site/barbearia-estilo-vivo');
    const servicesSection = response.body.data.sections.find((section) => section.key === 'services');
    const contactSection = response.body.data.sections.find((section) => section.key === 'contact');
    const gallerySection = response.body.data.sections.find((section) => section.key === 'gallery');

    expect(response.status).toBe(200);
    expect(servicesSection?.title).toBe('Nossos servicos');
    expect(servicesSection?.description).toBe('');
    expect(contactSection?.title).toBe('Contato e atendimento');
    expect(contactSection?.description).toBe('');
    expect(gallerySection?.title).toBe('Galeria de ambientes');
  });

  it('resolves explicit slug routes by slug even when the request host belongs to another tenant', async () => {
    await Business.create({
      name: 'Tenant por Dominio',
      slug: 'tenant-por-dominio',
      status: 'active',
      domains: { customDomain: 'cliente-dominio.com.br' },
      seo: {
        title: 'Tenant por Dominio',
        description: 'Tenant usado para validar isolamento por slug.',
      },
    });

    const response = await request(app)
      .get('/api/public/site/barbearia-estilo-vivo')
      .set('Host', 'cliente-dominio.com.br');

    expect(response.status).toBe(200);
    expect(response.body.meta.resolvedBy).toBe('slug');
    expect(response.body.data.business.slug).toBe('barbearia-estilo-vivo');
  });

  it('returns enabled services with optional images on the public site', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' }).lean();

    await BusinessSection.findOneAndUpdate(
      { businessId: business._id, key: 'services' },
      {
        type: 'custom',
        visible: true,
        title: 'Servicos',
        description: 'Catalogo atualizado',
        items: [
          {
            id: 'service-cut',
            name: 'Corte masculino',
            price: 45,
            description: 'Corte classico',
            imageUrl: 'https://cdn.example.com/services/corte.jpg',
          },
          {
            id: 'service-beard',
            name: 'Barba',
            price: 30,
            description: 'Acabamento completo',
          },
        ],
      },
    );

    const response = await request(app).get('/api/public/site/barbearia-estilo-vivo');
    const servicesSection = response.body.data.sections.find((section) => section.key === 'services');

    expect(response.status).toBe(200);
    expect(servicesSection).toMatchObject({
      type: 'services',
      visible: true,
      title: 'Servicos',
    });
    expect(servicesSection.items).toEqual([
      expect.objectContaining({
        id: 'service-cut',
        name: 'Corte masculino',
        imageUrl: 'https://cdn.example.com/services/corte.jpg',
      }),
      expect.objectContaining({
        id: 'service-beard',
        name: 'Barba',
      }),
    ]);
  });

  it('returns the resolved segment, modules and module data on the public site payload', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    await Business.findByIdAndUpdate(business._id, {
      segment: 'barbershop',
      modules: {
        catalog: true,
        appointments: true,
        cart: false,
        orders: false,
        loyalty: true,
        whatsapp: true,
        analytics: true,
      },
    });
    await Professional.create({
      businessId: business._id,
      name: 'Lia',
      role: 'Barbeira',
      avatar: 'https://cdn.example.com/professionals/lia.png',
      active: true,
    });
    await AppointmentService.create({
      businessId: business._id,
      name: 'Corte feminino',
      price: 90,
      durationMinutes: 70,
      description: 'Corte com finalizacao',
      active: true,
    });
    await Product.create({
      businessId: business._id,
      name: 'Pomada',
      description: 'Fixacao media',
      price: 35,
      image: 'https://cdn.example.com/products/pomada.png',
      category: 'Finalizacao',
      measurementUnit: 'unit',
      active: true,
    });

    const response = await request(app).get('/api/public/site/barbearia-estilo-vivo');

    expect(response.status).toBe(200);
    expect(response.body.data.business.segment).toBe('barbershop');
    expect(response.body.data.business.modules.appointments).toBe(true);
    expect(response.body.data.business.segmentConfig.label).toBe('Barbearia');
    expect(response.body.data.modulesData.professionals.some((item) => item.name === 'Lia')).toBe(true);
    expect(
      response.body.data.modulesData.appointmentServices.some((item) => item.name === 'Corte feminino'),
    ).toBe(true);
    expect(response.body.data.modulesData.products.some((item) => item.name === 'Pomada')).toBe(true);
  });

  it('returns active public products for the tenant slug', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });

    await Product.create([
      {
        businessId: business._id,
        name: 'Pomada premium',
        description: 'Brilho discreto',
        price: 44.9,
        image: 'https://cdn.example.com/products/pomada-premium.png',
        category: 'Finalizacao',
        measurementUnit: 'unit',
        active: true,
      },
      {
        businessId: business._id,
        name: 'Produto oculto',
        description: 'Nao deve aparecer',
        price: 99,
        category: 'Finalizacao',
        active: false,
      },
    ]);

    const response = await request(app).get('/api/public/site/barbearia-estilo-vivo/products');

    expect(response.status).toBe(200);
    expect(response.body.data.some((item) => item.name === 'Pomada premium')).toBe(true);
    expect(response.body.data.some((item) => item.name === 'Produto oculto')).toBe(false);
    expect(response.body.data.find((item) => item.name === 'Pomada premium')?.measurementUnit).toBe('unit');
  });

  it('creates a public appointment request with pending status', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTenantUpdates({ slug: 'barbearia-estilo-vivo' }, listener);
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const professional = await Professional.create({
      businessId: business._id,
      name: 'Lia',
      role: 'Barbeira',
      avatar: '',
      active: true,
    });
    const appointmentService = await AppointmentService.create({
      businessId: business._id,
      name: 'Corte classico',
      price: 45,
      durationMinutes: 40,
      description: 'Atendimento classico',
      active: true,
    });

    const response = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/appointment-requests')
      .send({
        professionalId: professional.id,
        serviceId: appointmentService.id,
        customerName: 'Marcos',
        customerPhone: '5511988887777',
        requestedDate: '2026-06-15',
        requestedTime: '09:30',
        notes: 'Chego um pouco antes',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.customerName).toBe('Marcos');
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: String(business._id),
        slug: 'barbearia-estilo-vivo',
        kind: 'appointment_created',
      }),
    );
    unsubscribe();
  });

  it('creates a public order with received status and calculated total', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTenantUpdates({ slug: 'barbearia-estilo-vivo' }, listener);
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const product = await Product.create({
      businessId: business._id,
      name: 'Kit barba',
      description: 'Oleo e pente',
      price: 59.9,
      image: '',
      category: 'Kits',
      measurementUnit: 'unit',
      active: true,
    });

    const response = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
        customerName: 'Marcos',
        customerPhone: '5511988887777',
        items: [
          {
            productId: product.id,
            name: 'Kit barba',
            quantity: 2,
            unitPrice: 59.9,
            notes: 'Embalar para presente',
          },
        ],
        deliveryType: 'delivery',
        address: 'Rua das Flores, 100',
        notes: 'Tocar interfone',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('received');
    expect(response.body.data.total).toBe(119.8);
    expect(response.body.data.payment).toEqual(
      expect.objectContaining({
        method: 'cash_on_pickup',
        status: 'manual',
        provider: 'manual',
        providerPaymentId: '',
        providerPreferenceId: '',
        checkoutUrl: '',
        updatedAt: null,
      }),
    );
    expect(response.body.data.items[0]).toMatchObject({
      measurementUnit: 'unit',
      displayQuantity: '2 unidades',
      itemTotal: 119.8,
    });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: String(business._id),
        slug: 'barbearia-estilo-vivo',
        kind: 'order_created',
      }),
    );
    unsubscribe();
  });

  it('creates a public order with manual Pix payment and returns the Pix payload generated by the backend', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const product = await Product.create({
      businessId: business._id,
      name: 'Kit barba premium',
      description: 'Oleo, pente e pomada',
      price: 89.9,
      image: '',
      category: 'Kits',
      measurementUnit: 'unit',
      active: true,
    });

    await Business.updateOne(
      { _id: business._id },
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

    const response = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
        customerName: 'Bruna',
        customerPhone: '5511992223344',
        items: [
          {
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: product.price,
          },
        ],
        payment: {
          method: 'pix',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.payment).toEqual(
      expect.objectContaining({
        method: 'pix',
        status: 'pending',
        provider: 'manual',
        amount: 89.9,
        paidAt: null,
      }),
    );
    expect(response.body.data.payment.pixCopyPaste).toEqual(expect.any(String));
    expect(response.body.data.payment.pixCopyPaste).toContain('br.gov.bcb.pix');
  });

  it('creates a public order with manual payment on pickup when that method is selected', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const product = await Product.create({
      businessId: business._id,
      name: 'Pomada assinatura',
      description: 'Fixacao forte',
      price: 49.9,
      image: '',
      category: 'Finalizacao',
      measurementUnit: 'unit',
      active: true,
    });

    await Business.updateOne(
      { _id: business._id },
      {
        paymentSettings: {
          enabled: true,
          methods: {
            pix: false,
            creditCard: false,
            debitCard: false,
            cashOnPickup: true,
            cashOnDelivery: false,
          },
          provider: 'manual',
        },
      },
    );

    const response = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
        customerName: 'Carla',
        customerPhone: '5511912345678',
        items: [
          {
            productId: product.id,
            name: product.name,
            quantity: 2,
            unitPrice: product.price,
          },
        ],
        payment: {
          method: 'cash_on_pickup',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.payment).toEqual(
      expect.objectContaining({
        method: 'cash_on_pickup',
        status: 'manual',
        provider: 'manual',
        amount: 99.8,
      }),
    );
  });

  it('rejects a public order when the selected payment method is disabled for the tenant', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const product = await Product.create({
      businessId: business._id,
      name: 'Oleo barba test',
      description: 'Teste',
      price: 29.9,
      image: '',
      category: 'Barba',
      measurementUnit: 'unit',
      active: true,
    });

    await Business.updateOne(
      { _id: business._id },
      {
        paymentSettings: {
          enabled: true,
          methods: {
            pix: false,
            creditCard: false,
            debitCard: false,
            cashOnPickup: true,
            cashOnDelivery: false,
          },
          provider: 'manual',
        },
      },
    );

    const response = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
        customerName: 'Davi',
        customerPhone: '5511912345678',
        items: [
          {
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: product.price,
          },
        ],
        payment: {
          method: 'pix',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('payment_method_unavailable');
  });

  it('rejects online checkout when the tenant selects Asaas without a valid Asaas connection', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const product = await Product.create({
      businessId: business._id,
      name: 'Maquina premium',
      description: 'Equipamento profissional',
      price: 199.9,
      image: '',
      category: 'Acessorios',
      measurementUnit: 'unit',
      active: true,
    });

    await Business.updateOne(
      { _id: business._id },
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
          provider: 'asaas',
          asaas: {
            enabled: true,
            walletId: '',
            apiKeyEncrypted: '',
            accountEmail: 'seller@example.com',
            status: 'pending',
          },
        },
      },
    );

    const response = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
        customerName: 'Bianca',
        customerPhone: '5511988877665',
        items: [
          {
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: product.price,
          },
        ],
        payment: {
          method: 'credit_card',
          provider: 'asaas',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('payment_provider_unavailable');
    expect(mercadoPagoServiceMock.createMercadoPagoCheckoutPreference).not.toHaveBeenCalled();
  });

  it('creates an Asaas Pix order and persists the provider payment fields returned by the charge flow', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const product = await Product.create({
      businessId: business._id,
      name: 'Combo asaas pix',
      description: 'Checkout online via Asaas',
      price: 149.9,
      image: '',
      category: 'Combos',
      measurementUnit: 'unit',
      active: true,
    });
    await SystemSetting.create({
      key: 'finance:asaas',
      value: {
        platformWalletId: 'wallet_platform_global',
        defaultPlatformFeePercent: 5,
      },
    });

    await Business.updateOne(
      { _id: business._id },
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
          provider: 'asaas',
          asaas: {
            enabled: true,
            subaccountId: 'subacc_123',
            walletId: 'wallet_sub',
            apiKeyEncrypted: 'encrypted-sub-key',
            accountEmail: 'seller@example.com',
            accountName: 'Casa do Preto',
            status: 'active',
          },
          split: {
            enabled: false,
            platformFeePercent: 0,
            mode: 'percentage',
            inheritsGlobal: true,
          },
        },
      },
    );

    asaasServiceMock.createAsaasCustomer.mockResolvedValue({
      id: 'cus_123',
      name: 'Nina',
    });
    asaasServiceMock.createAsaasPaymentCharge.mockResolvedValue({
      id: 'pay_123',
      status: 'PENDING',
      invoiceUrl: 'https://sandbox.asaas.com/i/pay_123',
    });
    asaasServiceMock.getAsaasPixQrCode.mockResolvedValue({
      payload: '000201010212',
      encodedImage: 'data:image/png;base64,abc123',
    });

    const response = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
        customerName: 'Nina',
        customerPhone: '5511991112233',
        items: [
          {
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: 1,
            itemTotal: 1,
          },
        ],
        payment: {
          method: 'pix',
          provider: 'asaas',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.total).toBe(149.9);
    expect(response.body.data.payment).toEqual(
      expect.objectContaining({
        method: 'pix',
        provider: 'asaas',
        status: 'pending',
        amount: 149.9,
        providerPaymentId: 'pay_123',
        providerCustomerId: 'cus_123',
        invoiceUrl: 'https://sandbox.asaas.com/i/pay_123',
        pixCopyPaste: '000201010212',
        pixQrCode: 'data:image/png;base64,abc123',
        platformFeeAmount: 7.5,
        tenantNetAmount: 142.4,
      }),
    );
    expect(asaasServiceMock.createAsaasCustomer).toHaveBeenCalledOnce();
    expect(asaasServiceMock.createAsaasPaymentCharge).toHaveBeenCalledOnce();
    expect(asaasServiceMock.getAsaasPixQrCode).toHaveBeenCalledOnce();
    expect(asaasServiceMock.createAsaasPaymentCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        charge: expect.objectContaining({
          split: [{ walletId: 'wallet_platform_global', percentualValue: 5 }],
        }),
      }),
    );
    expect(mercadoPagoServiceMock.createMercadoPagoCheckoutPreference).not.toHaveBeenCalled();
  });

  it('creates a Checkout Pro order for a Mercado Pago tenant and returns the checkout URL', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const product = await Product.create({
      businessId: business._id,
      name: 'Combo premium',
      description: 'Servico + produto',
      price: 79.9,
      image: '',
      category: 'Combos',
      measurementUnit: 'unit',
      active: true,
    });

    await Business.updateOne(
      { _id: business._id },
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
            publicKey: 'APP_USR-test-public-key',
            accessTokenEncrypted: 'fake-encrypted-token',
            webhookSecretEncrypted: 'fake-encrypted-webhook',
            accountEmail: 'seller@example.com',
          },
        },
      },
    );
    mercadoPagoServiceMock.createMercadoPagoCheckoutPreference.mockResolvedValue({
      preferenceId: 'pref_test_123',
      checkoutUrl: 'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_test_123',
      externalReference: `tenant:${business._id.toString()}:order:fake-order`,
    });

    const response = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
        customerName: 'Nina',
        customerPhone: '5511991112233',
        items: [
          {
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: 1,
            itemTotal: 1,
          },
        ],
        payment: {
          method: 'credit_card',
          provider: 'mercado_pago',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.total).toBe(79.9);
    expect(response.body.data.payment).toEqual(
      expect.objectContaining({
        method: 'credit_card',
        provider: 'mercado_pago',
        status: 'pending',
        amount: 79.9,
        providerPreferenceId: 'pref_test_123',
        checkoutUrl: 'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_test_123',
      }),
    );
    expect(response.body.data.payment.providerPaymentId).toBe('');
    expect(mercadoPagoServiceMock.createMercadoPagoCheckoutPreference).toHaveBeenCalledOnce();
  });

  it('keeps manual checkout working even when the tenant also has Mercado Pago configured', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const product = await Product.create({
      businessId: business._id,
      name: 'Pomada matte',
      description: 'Finalizacao',
      price: 42.5,
      image: '',
      category: 'Produtos',
      measurementUnit: 'unit',
      active: true,
    });

    await Business.updateOne(
      { _id: business._id },
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
          pix: {
            key: 'pix-chave-teste',
            merchantName: 'TapLink Teste',
            merchantCity: 'SAO PAULO',
          },
          mercadoPago: {
            enabled: true,
            publicKey: 'APP_USR-test-public-key',
            accessTokenEncrypted: 'fake-encrypted-token',
            webhookSecretEncrypted: 'fake-encrypted-webhook',
            accountEmail: 'seller@example.com',
          },
        },
      },
    );

    const response = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
        customerName: 'Dora',
        customerPhone: '5511912345678',
        items: [
          {
            productId: product.id,
            name: product.name,
            quantity: 2,
            unitPrice: product.price,
          },
        ],
        payment: {
          method: 'cash_on_delivery',
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.data.payment).toEqual(
      expect.objectContaining({
        method: 'cash_on_delivery',
        provider: 'manual',
        status: 'manual',
        amount: 85,
        checkoutUrl: '',
        providerPreferenceId: '',
      }),
    );
    expect(mercadoPagoServiceMock.createMercadoPagoCheckoutPreference).not.toHaveBeenCalled();
  });

  it('rejects Mercado Pago checkout when the tenant has no valid Mercado Pago credentials configured', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const product = await Product.create({
      businessId: business._id,
      name: 'Navalha premium',
      description: 'Acessorio',
      price: 64.9,
      image: '',
      category: 'Acessorios',
      measurementUnit: 'unit',
      active: true,
    });

    await Business.updateOne(
      { _id: business._id },
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
            publicKey: 'APP_USR-test-public-key',
            accessTokenEncrypted: '',
            webhookSecretEncrypted: '',
            accountEmail: 'seller@example.com',
          },
        },
      },
    );

    const response = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
        customerName: 'Erika',
        customerPhone: '5511988877665',
        items: [
          {
            productId: product.id,
            name: product.name,
            quantity: 1,
            unitPrice: product.price,
          },
        ],
        payment: {
          method: 'debit_card',
          provider: 'mercado_pago',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('payment_provider_unavailable');
    expect(mercadoPagoServiceMock.createMercadoPagoCheckoutPreference).not.toHaveBeenCalled();
  });

  it('calculates proportional totals for kg products and ignores manipulated item totals from the frontend', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const product = await Product.create({
      businessId: business._id,
      name: 'Picanha',
      description: 'Corte nobre',
      price: 59.9,
      image: '',
      category: 'Carnes',
      measurementUnit: 'kg',
      active: true,
    });

    const response = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
        customerName: 'Carlos',
        customerPhone: '5511988887777',
        items: [
          {
            productId: product.id,
            name: 'Picanha',
            quantity: 0.4,
            unitPrice: 1,
            measurementUnit: 'kg',
            displayQuantity: '400g',
            itemTotal: 1,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.total).toBe(23.96);
    expect(response.body.data.items[0]).toMatchObject({
      quantity: 0.4,
      unitPrice: 59.9,
      measurementUnit: 'kg',
      displayQuantity: '400g',
      itemTotal: 23.96,
    });

    const secondResponse = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
        customerName: 'Carlos',
        customerPhone: '5511988887777',
        items: [
          {
            productId: product.id,
            name: 'Picanha',
            quantity: 0.5,
            unitPrice: 10,
            measurementUnit: 'kg',
            displayQuantity: '500g',
            itemTotal: 5,
          },
        ],
      });

    expect(secondResponse.status).toBe(201);
    expect(secondResponse.body.data.total).toBe(29.95);
    expect(secondResponse.body.data.items[0]).toMatchObject({
      quantity: 0.5,
      unitPrice: 59.9,
      measurementUnit: 'kg',
      displayQuantity: '500g',
      itemTotal: 29.95,
    });
  });

  it('rejects decimal quantities for integer-based product units', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const product = await Product.create({
      businessId: business._id,
      name: 'Carvao',
      description: 'Saco de carvao',
      price: 32.5,
      image: '',
      category: 'Apoio',
      measurementUnit: 'unit',
      active: true,
    });

    const response = await request(app)
      .post('/api/public/site/barbearia-estilo-vivo/orders')
      .send({
        customerName: 'Carlos',
        customerPhone: '5511988887777',
        items: [
          {
            productId: product.id,
            name: 'Carvao',
            quantity: 1.5,
            unitPrice: 32.5,
            measurementUnit: 'unit',
          },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
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
    expect(response.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=120');
    expect(response.body.data.business.slug).toBe('barbearia-estilo-vivo');
    expect(response.body.meta.resolvedBy).toBe('host');
  });

  it('requires a valid preview token before bypassing cache for preview public requests by host', async () => {
    await Business.findOneAndUpdate(
      { slug: 'barbearia-estilo-vivo' },
      { domains: { subdomain: 'estilo-vivo', customDomain: '' } },
    );

    const previewRequestedResponse = await request(app)
      .get('/api/public/site')
      .query({ host: 'estilo-vivo.tenant.local', preview: '1', t: '1700000000000' });

    expect(previewRequestedResponse.status).toBe(200);
    expect(previewRequestedResponse.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=120');
    expect(previewRequestedResponse.body.meta.previewAuthorized).toBe(false);

    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' }).lean();
    const previewTokenResponse = await request(app)
      .post(`/api/admin/businesses/${business._id.toString()}/preview-token`)
      .set('Authorization', `Bearer ${adminToken}`);

    const previewResponse = await request(app)
      .get('/api/public/site')
      .query({
        host: 'estilo-vivo.tenant.local',
        preview: '1',
        t: '1700000000000',
        previewToken: previewTokenResponse.body.data.token,
      });

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.headers['cache-control']).toBe('no-store');
    expect(previewResponse.body.meta.previewAuthorized).toBe(true);
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

  it('ignores analytics events sent from an authorized preview session', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' }).lean();
    const previewTokenResponse = await request(app)
      .post(`/api/admin/businesses/${business._id.toString()}/preview-token`)
      .set('Authorization', `Bearer ${adminToken}`);

    const response = await request(app).post('/api/public/analytics/events').send({
      slug: 'barbearia-estilo-vivo',
      eventType: 'page_view',
      targetType: 'page',
      preview: true,
      previewToken: previewTokenResponse.body.data.token,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.recorded).toBe(false);
    expect(response.body.data.ignoredReason).toBe('authorized_preview');
    expect(await AnalyticsEvent.countDocuments()).toBe(0);
  });

  it('rejects invalid analytics payloads', async () => {
    const response = await request(app).post('/api/public/analytics/events').send({
      slug: 'barbearia-estilo-vivo',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });
});
