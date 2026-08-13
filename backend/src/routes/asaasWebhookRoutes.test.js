import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { hashPassword } from '../utils/password.js';

const asaasServiceMock = vi.hoisted(() => ({
  getAsaasPayment: vi.fn(),
}));

vi.mock('../services/asaasService.js', async () => {
  const actual = await vi.importActual('../services/asaasService.js');

  return {
    ...actual,
    getAsaasPayment: asaasServiceMock.getAsaasPayment,
  };
});

let app;
let connectDatabase;
let disconnectDatabase;
let seedDemoData;
let Business;
let Order;
let Payment;
let SystemSetting;
let TenantLedgerEntry;
let WebhookEvent;
let User;
let subscribeToTenantUpdates;
let encryptSecret;
let envConfig;
let mongoServer;

describe('Asaas webhook routes', () => {
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
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY = '12345678901234567890123456789012';
    process.env.ASAAS_API_KEY = '$aact_hmlg_platform_root';
    process.env.ASAAS_WEBHOOK_TOKEN = 'asaas-webhook-token';
    process.env.ASAAS_WEBHOOK_AUTH_TOKEN = 'asaas-webhook-token';

    ({ connectDatabase, disconnectDatabase } = await import('../config/database.js'));
    ({ seedDemoData } = await import('../utils/seedDemoData.js'));
    ({ Business } = await import('../models/Business.js'));
    ({ Order } = await import('../models/Order.js'));
    ({ Payment } = await import('../models/Payment.js'));
    ({ SystemSetting } = await import('../models/SystemSetting.js'));
    ({ TenantLedgerEntry } = await import('../models/TenantLedgerEntry.js'));
    ({ WebhookEvent } = await import('../models/WebhookEvent.js'));
    ({ User } = await import('../models/User.js'));
    ({ subscribeToTenantUpdates } = await import('../services/tenantRealtimeService.js'));
    ({ encryptSecret } = await import('../utils/secretCrypto.js'));
    ({ env: envConfig } = await import('../config/env.js'));
    ({ default: app } = await import('../app.js'));

    await connectDatabase();
  }, 30000);

  beforeEach(async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'asaas-webhook-token';
    process.env.ASAAS_WEBHOOK_AUTH_TOKEN = 'asaas-webhook-token';
    process.env.ASAAS_API_KEY = '$aact_hmlg_platform_root';
    envConfig.asaasApiKey = '$aact_hmlg_platform_root';
    envConfig.asaasWebhookAuthToken = 'asaas-webhook-token';
    envConfig.paymentCredentialsEncryptionKey = '12345678901234567890123456789012';
    await seedDemoData({ reset: true });
    await Promise.all([
      Payment.deleteMany({}),
      WebhookEvent.deleteMany({}),
      TenantLedgerEntry.deleteMany({}),
      SystemSetting.deleteMany({}),
      User.deleteMany({ email: /webhook-owner@cliente\.local$/ }),
    ]);
    asaasServiceMock.getAsaasPayment.mockReset();
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
  });

  async function createAsaasOrderFixture() {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });

    await SystemSetting.create({
      key: 'finance:asaas',
      value: {
        paymentArchitecture: 'centralized',
        defaultPlatformFeePercent: 5,
      },
    });

    await Business.updateOne(
      { _id: business._id },
      {
        modules: {
          ...(business.modules?.toObject ? business.modules.toObject() : business.modules || {}),
          catalog: true,
          cart: true,
          orders: true,
        },
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
            accountEmail: 'seller@example.com',
            accountName: 'Casa do Preto',
            status: 'active',
          },
        },
      },
    );

    const order = await Order.create({
      businessId: business._id,
      customerName: 'Marcos',
      customerPhone: '5511988887777',
      items: [
        {
          name: 'Picanha',
          quantity: 1,
          unitPrice: 79.9,
          measurementUnit: 'unit',
          displayQuantity: '1 unidade',
          itemTotal: 79.9,
        },
      ],
      total: 79.9,
      status: 'received',
      receivedAt: new Date('2026-06-01T18:00:00.000Z'),
      payment: {
        method: 'pix',
        provider: 'asaas',
        paymentArchitecture: 'centralized',
        status: 'pending',
        amount: 79.9,
        grossAmount: 79.9,
        platformFeeAmount: 4,
        tenantNetAmount: 75.9,
        providerPaymentId: 'pay_123',
        providerCustomerId: 'cus_123',
        invoiceUrl: 'https://sandbox.asaas.com/i/pay_123',
        updatedAt: new Date('2026-06-01T18:00:00.000Z'),
      },
      paymentEvents: [
        {
          type: 'charge_created',
          provider: 'asaas',
          status: 'pending',
          providerPaymentId: 'pay_123',
          occurredAt: new Date('2026-06-01T18:00:00.000Z'),
        },
      ],
    });

    const externalReference = `tenant:${business._id.toString()}:order:${order._id.toString()}`;

    await Payment.create({
      businessId: business._id,
      orderId: order._id,
      provider: 'asaas',
      method: 'pix',
      paymentArchitecture: 'centralized',
      billingType: 'PIX',
      status: 'pending',
      providerStatus: 'PENDING',
      providerPaymentId: 'pay_123',
      providerCustomerId: 'cus_123',
      externalReference,
      amount: 79.9,
      grossAmount: 79.9,
      platformFeeAmount: 4,
      tenantNetAmount: 75.9,
      invoiceUrl: 'https://sandbox.asaas.com/i/pay_123',
      providerUpdatedAt: new Date('2026-06-01T18:00:00.000Z'),
    });

    return { business, order, externalReference };
  }

  async function loginTenantOwner(businessId) {
    await User.deleteOne({ email: 'webhook-owner@cliente.local' });
    await User.create({
      name: 'Webhook Owner',
      email: 'webhook-owner@cliente.local',
      passwordHash: await hashPassword('owner123456'),
      roles: [],
      roleLevel: 2,
      businessId,
      status: 'active',
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'webhook-owner@cliente.local', password: 'owner123456' });

    expect(response.status).toBe(200);
    return response.body.data.token;
  }

  it('marks the tenant order as paid when Asaas confirms a paid payment', async () => {
    const listener = vi.fn();
    const { business, order } = await createAsaasOrderFixture();
    const unsubscribe = subscribeToTenantUpdates({ slug: business.slug }, listener);
    const externalReference = `tenant:${business._id.toString()}:order:${order._id.toString()}`;

    asaasServiceMock.getAsaasPayment.mockResolvedValue({
      id: 'pay_123',
      status: 'RECEIVED',
      value: 79.9,
      externalReference,
      confirmedDate: '2026-06-01T18:10:00.000Z',
    });

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_received_1',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    expect(response.status).toBe(204);
    const updatedOrder = await Order.findById(order._id).lean();
    expect(updatedOrder.payment).toEqual(
      expect.objectContaining({
        provider: 'asaas',
        status: 'paid',
        providerPaymentId: 'pay_123',
      }),
    );
    expect(updatedOrder.payment.paidAt).toBeTruthy();
    expect(updatedOrder.paymentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'webhook_received',
          provider: 'asaas',
          providerEvent: 'PAYMENT_RECEIVED',
          providerPaymentId: 'pay_123',
        }),
        expect.objectContaining({
          type: 'payment_paid',
          provider: 'asaas',
          status: 'paid',
          providerPaymentId: 'pay_123',
        }),
      ]),
    );
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: business._id.toString(),
        slug: business.slug,
        kind: 'payment_updated',
      }),
    );
    expect(await WebhookEvent.findOne({ provider: 'asaas', eventId: 'evt_payment_received_1' }).lean()).toEqual(
      expect.objectContaining({
        status: 'processed',
        eventType: 'PAYMENT_RECEIVED',
        providerResourceId: 'pay_123',
        resourceId: order._id.toString(),
      }),
    );
    expect(await Payment.findOne({ provider: 'asaas', providerPaymentId: 'pay_123' }).lean()).toEqual(
      expect.objectContaining({
        businessId: business._id,
        orderId: order._id,
        status: 'paid',
        paymentArchitecture: 'centralized',
        providerStatus: 'RECEIVED',
        externalReference,
        amount: 79.9,
        grossAmount: 79.9,
        platformFeeAmount: 4,
        tenantNetAmount: 75.9,
      }),
    );
    expect(await TenantLedgerEntry.find({ businessId: business._id }).sort({ type: 1 }).lean()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paymentId: expect.anything(),
          orderId: order._id,
          type: 'sale_gross',
          status: 'available',
          amount: 79.9,
        }),
        expect.objectContaining({
          paymentId: expect.anything(),
          orderId: order._id,
          type: 'platform_fee',
          status: 'available',
          amount: -4,
        }),
      ]),
    );
    unsubscribe();
  });

  it('keeps PAYMENT_CREATED as pending and does not create ledger entries', async () => {
    const { business, order, externalReference } = await createAsaasOrderFixture();

    asaasServiceMock.getAsaasPayment.mockResolvedValue({
      id: 'pay_123',
      status: 'PENDING',
      value: 79.9,
      externalReference,
    });

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_created_pending',
        event: 'PAYMENT_CREATED',
        payment: {
          id: 'pay_123',
          externalReference,
          status: 'PENDING',
          value: 79.9,
          billingType: 'PIX',
          customer: 'cus_123',
        },
      });

    expect(response.status).toBe(204);
    expect((await Order.findById(order._id).lean()).payment.status).toBe('pending');
    expect(await Payment.findOne({ provider: 'asaas', providerPaymentId: 'pay_123' }).lean()).toEqual(
      expect.objectContaining({
        businessId: business._id,
        orderId: order._id,
        status: 'pending',
        providerStatus: 'PENDING',
      }),
    );
    expect(await TenantLedgerEntry.countDocuments({ businessId: business._id })).toBe(0);
  });

  it('marks Payment and Order.payment as paid when Asaas confirms the charge', async () => {
    const { business, order, externalReference } = await createAsaasOrderFixture();

    asaasServiceMock.getAsaasPayment.mockResolvedValue({
      id: 'pay_123',
      status: 'CONFIRMED',
      value: 79.9,
      netValue: 75.9,
      billingType: 'PIX',
      customer: 'cus_123',
      externalReference,
      confirmedDate: '2026-06-01T18:10:00.000Z',
    });

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_confirmed_paid',
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: 'pay_123',
          externalReference,
          status: 'CONFIRMED',
          value: 79.9,
          netValue: 75.9,
          billingType: 'PIX',
          customer: 'cus_123',
        },
      });

    expect(response.status).toBe(204);
    expect((await Order.findById(order._id).lean()).payment.status).toBe('paid');
    expect(await Payment.findOne({ provider: 'asaas', providerPaymentId: 'pay_123' }).lean()).toEqual(
      expect.objectContaining({
        businessId: business._id,
        orderId: order._id,
        status: 'paid',
        providerStatus: 'CONFIRMED',
      }),
    );
    expect(await TenantLedgerEntry.countDocuments({ businessId: business._id })).toBe(2);
  });

  it('uses providerPaymentId as the primary anchor when the webhook payload omits externalReference', async () => {
    const { business, order, externalReference } = await createAsaasOrderFixture();

    asaasServiceMock.getAsaasPayment.mockResolvedValue({
      id: 'pay_123',
      status: 'RECEIVED',
      value: 79.9,
      externalReference,
      confirmedDate: '2026-06-01T18:10:00.000Z',
    });

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_received_provider_anchor',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          status: 'RECEIVED',
        },
      });

    expect(response.status).toBe(204);
    expect((await Order.findById(order._id).lean()).payment.status).toBe('paid');
    expect(await Payment.findOne({ provider: 'asaas', providerPaymentId: 'pay_123' }).lean()).toEqual(
      expect.objectContaining({
        businessId: business._id,
        orderId: order._id,
        externalReference,
        status: 'paid',
      }),
    );
  });

  it('reconciles a valid Asaas charge when the webhook arrives before the local Payment is stored', async () => {
    const { business, order, externalReference } = await createAsaasOrderFixture();
    await Payment.deleteMany({ provider: 'asaas', providerPaymentId: 'pay_123' });

    asaasServiceMock.getAsaasPayment.mockResolvedValue({
      id: 'pay_123',
      status: 'RECEIVED',
      value: 79.9,
      externalReference,
      confirmedDate: '2026-06-01T18:10:00.000Z',
    });

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_received_before_payment_insert',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    expect(response.status).toBe(204);
    expect((await Order.findById(order._id).lean()).payment.status).toBe('paid');
    expect(await Payment.findOne({ provider: 'asaas', providerPaymentId: 'pay_123' }).lean()).toEqual(
      expect.objectContaining({
        businessId: business._id,
        orderId: order._id,
        status: 'paid',
        externalReference,
      }),
    );
    expect(await TenantLedgerEntry.countDocuments({ businessId: business._id })).toBe(2);
  });

  it('updates an archived local Order payment from Asaas without returning a REST-style 404', async () => {
    const { business, order, externalReference } = await createAsaasOrderFixture();
    await Order.updateOne({ _id: order._id }, { archivedAt: new Date('2026-06-01T18:05:00.000Z') });

    asaasServiceMock.getAsaasPayment.mockResolvedValue({
      id: 'pay_123',
      status: 'RECEIVED',
      value: 79.9,
      externalReference,
      confirmedDate: '2026-06-01T18:10:00.000Z',
    });

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_received_archived_order',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    const updatedOrder = await Order.findById(order._id).lean();

    expect(response.status).toBe(204);
    expect(updatedOrder.archivedAt).toBeTruthy();
    expect(updatedOrder.payment.status).toBe('paid');
    expect(await Payment.findOne({ provider: 'asaas', providerPaymentId: 'pay_123' }).lean()).toEqual(
      expect.objectContaining({
        businessId: business._id,
        orderId: order._id,
        status: 'paid',
      }),
    );
  });

  it('returns paid payment status in the client panel after Asaas confirms the order', async () => {
    const { business, order, externalReference } = await createAsaasOrderFixture();
    const ownerToken = await loginTenantOwner(business._id);

    asaasServiceMock.getAsaasPayment.mockResolvedValue({
      id: 'pay_123',
      status: 'RECEIVED',
      value: 79.9,
      externalReference,
      confirmedDate: '2026-06-01T18:10:00.000Z',
    });

    const webhookResponse = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_received_panel_status',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    const panelResponse = await request(app)
      .get('/api/panel/orders')
      .set('Authorization', `Bearer ${ownerToken}`);
    const panelOrder = panelResponse.body.data.find((item) => item.id === order._id.toString());

    expect(webhookResponse.status).toBe(204);
    expect(panelResponse.status).toBe(200);
    expect(panelOrder).toEqual(
      expect.objectContaining({
        id: order._id.toString(),
        payment: expect.objectContaining({
          provider: 'asaas',
          providerPaymentId: 'pay_123',
          status: 'paid',
        }),
      }),
    );
  });

  it('acknowledges unsupported authenticated payment events without mutating local finance records', async () => {
    const { business, order, externalReference } = await createAsaasOrderFixture();

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_unknown_status',
        event: 'PAYMENT_AWAITING_RISK_ANALYSIS',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    expect(response.status).toBe(204);
    expect(asaasServiceMock.getAsaasPayment).not.toHaveBeenCalled();
    expect((await Order.findById(order._id).lean()).payment.status).toBe('pending');
    expect(await TenantLedgerEntry.countDocuments({ businessId: business._id })).toBe(0);
    expect(await WebhookEvent.findOne({ provider: 'asaas', eventId: 'evt_payment_unknown_status' }).lean()).toEqual(
      expect.objectContaining({
        status: 'ignored',
        errorCode: 'unsupported_payment_event',
      }),
    );
  });

  it('rejects the webhook when the Asaas auth token header is invalid', async () => {
    const { business, order } = await createAsaasOrderFixture();

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'invalid-token')
      .send({
        id: 'evt_invalid_token',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference: `tenant:${business._id.toString()}:order:${order._id.toString()}`,
        },
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('asaas_webhook_unauthorized');
    expect(asaasServiceMock.getAsaasPayment).not.toHaveBeenCalled();
  });

  it('rejects incomplete webhook payloads before calling Asaas', async () => {
    const { business, order } = await createAsaasOrderFixture();

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference: `tenant:${business._id.toString()}:order:${order._id.toString()}`,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('asaas_webhook_invalid');
    expect(asaasServiceMock.getAsaasPayment).not.toHaveBeenCalled();
    expect(await WebhookEvent.countDocuments({ provider: 'asaas' })).toBe(0);
  });

  it('keeps the webhook idempotent when the same paid notification is delivered twice', async () => {
    const { business, order } = await createAsaasOrderFixture();
    const externalReference = `tenant:${business._id.toString()}:order:${order._id.toString()}`;

    asaasServiceMock.getAsaasPayment.mockResolvedValue({
      id: 'pay_123',
      status: 'RECEIVED',
      value: 79.9,
      externalReference,
      confirmedDate: '2026-06-01T18:10:00.000Z',
    });

    const firstResponse = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_received_duplicate',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    const secondResponse = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_received_duplicate',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    const updatedOrder = await Order.findById(order._id).lean();
    const paidEvents = updatedOrder.paymentEvents.filter((item) => item.type === 'payment_paid');

    expect(firstResponse.status).toBe(204);
    expect(secondResponse.status).toBe(204);
    expect(updatedOrder.payment.status).toBe('paid');
    expect(paidEvents).toHaveLength(1);
    expect(asaasServiceMock.getAsaasPayment).toHaveBeenCalledTimes(1);
    expect(await WebhookEvent.countDocuments({ provider: 'asaas', eventId: 'evt_payment_received_duplicate' })).toBe(1);
    expect(await TenantLedgerEntry.countDocuments({ businessId: business._id })).toBe(2);
  });

  it('keeps webhook effects idempotent when duplicate events arrive concurrently', async () => {
    const { business, order } = await createAsaasOrderFixture();
    const externalReference = `tenant:${business._id.toString()}:order:${order._id.toString()}`;

    asaasServiceMock.getAsaasPayment.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: 'pay_123',
              status: 'RECEIVED',
              value: 79.9,
              externalReference,
              confirmedDate: '2026-06-01T18:10:00.000Z',
            });
          }, 150);
        }),
    );

    const [firstResponse, secondResponse] = await Promise.all([
      request(app)
        .post('/api/webhooks/asaas')
        .set('asaas-access-token', 'asaas-webhook-token')
        .send({
          id: 'evt_payment_received_concurrent',
          event: 'PAYMENT_RECEIVED',
          payment: {
            id: 'pay_123',
            externalReference,
          },
        }),
      request(app)
        .post('/api/webhooks/asaas')
        .set('asaas-access-token', 'asaas-webhook-token')
        .send({
          id: 'evt_payment_received_concurrent',
          event: 'PAYMENT_RECEIVED',
          payment: {
            id: 'pay_123',
            externalReference,
          },
        }),
    ]);

    const updatedOrder = await Order.findById(order._id).lean();
    const paidEvents = updatedOrder.paymentEvents.filter((item) => item.type === 'payment_paid');

    expect(firstResponse.status).toBe(204);
    expect(secondResponse.status).toBe(204);
    expect(updatedOrder.payment.status).toBe('paid');
    expect(paidEvents).toHaveLength(1);
    expect(asaasServiceMock.getAsaasPayment).toHaveBeenCalledTimes(1);
    expect(await WebhookEvent.countDocuments({ provider: 'asaas', eventId: 'evt_payment_received_concurrent' })).toBe(1);
    expect(await Payment.countDocuments({ provider: 'asaas', providerPaymentId: 'pay_123' })).toBe(1);
    expect(await TenantLedgerEntry.countDocuments({ businessId: business._id })).toBe(2);
  });

  it('allows retrying a failed webhook event without duplicating the financial effect', async () => {
    const { business, order } = await createAsaasOrderFixture();
    const externalReference = `tenant:${business._id.toString()}:order:${order._id.toString()}`;

    asaasServiceMock.getAsaasPayment
      .mockRejectedValueOnce(new Error('Asaas temporariamente indisponivel'))
      .mockResolvedValueOnce({
        id: 'pay_123',
        status: 'RECEIVED',
        value: 79.9,
        externalReference,
        confirmedDate: '2026-06-01T18:10:00.000Z',
      });

    const firstResponse = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_retry_after_failure',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    expect(firstResponse.status).toBe(500);
    expect(await WebhookEvent.findOne({ eventId: 'evt_payment_retry_after_failure' }).lean()).toEqual(
      expect.objectContaining({
        status: 'failed',
      }),
    );

    const secondResponse = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_retry_after_failure',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    const updatedOrder = await Order.findById(order._id).lean();
    const paidEvents = updatedOrder.paymentEvents.filter((item) => item.type === 'payment_paid');

    expect(secondResponse.status).toBe(204);
    expect(updatedOrder.payment.status).toBe('paid');
    expect(paidEvents).toHaveLength(1);
    expect(asaasServiceMock.getAsaasPayment).toHaveBeenCalledTimes(2);
    expect(await WebhookEvent.findOne({ eventId: 'evt_payment_retry_after_failure' }).lean()).toEqual(
      expect.objectContaining({
        status: 'processed',
      }),
    );
    expect(await Payment.countDocuments({ provider: 'asaas', providerPaymentId: 'pay_123' })).toBe(1);
    expect(await TenantLedgerEntry.countDocuments({ businessId: business._id })).toBe(2);
  });

  it('does not let an older pending event downgrade an already paid payment', async () => {
    const { business, order } = await createAsaasOrderFixture();
    const externalReference = `tenant:${business._id.toString()}:order:${order._id.toString()}`;

    asaasServiceMock.getAsaasPayment
      .mockResolvedValueOnce({
        id: 'pay_123',
        status: 'RECEIVED',
        value: 79.9,
        externalReference,
        confirmedDate: '2026-06-01T18:10:00.000Z',
      })
      .mockResolvedValueOnce({
        id: 'pay_123',
        status: 'PENDING',
        value: 79.9,
        externalReference,
      });

    const paidResponse = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_received_before_pending',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });
    const pendingResponse = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_pending_late',
        event: 'PAYMENT_CREATED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    const updatedOrder = await Order.findById(order._id).lean();
    const storedPayment = await Payment.findOne({ provider: 'asaas', providerPaymentId: 'pay_123' }).lean();

    expect(paidResponse.status).toBe(204);
    expect(pendingResponse.status).toBe(204);
    expect(updatedOrder.payment.status).toBe('paid');
    expect(storedPayment.status).toBe('paid');
    expect(storedPayment.providerStatus).toBe('PENDING');
  });

  it('marks an existing Asaas order payment as cancelled when PAYMENT_DELETED arrives', async () => {
    const { business, order } = await createAsaasOrderFixture();
    const externalReference = `tenant:${business._id.toString()}:order:${order._id.toString()}`;

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_deleted_existing_order',
        event: 'PAYMENT_DELETED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    expect(response.status).toBe(204);
    expect(asaasServiceMock.getAsaasPayment).not.toHaveBeenCalled();

    const updatedOrder = await Order.findById(order._id).lean();
    expect(updatedOrder.payment).toEqual(
      expect.objectContaining({
        provider: 'asaas',
        status: 'cancelled',
        providerPaymentId: 'pay_123',
      }),
    );
    expect(updatedOrder.paymentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'payment_cancelled',
          provider: 'asaas',
          providerEvent: 'PAYMENT_DELETED',
          providerPaymentId: 'pay_123',
        }),
      ]),
    );

    expect(await Payment.findOne({ provider: 'asaas', providerPaymentId: 'pay_123' }).lean()).toEqual(
      expect.objectContaining({
        businessId: business._id,
        orderId: order._id,
        status: 'cancelled',
        providerStatus: 'CANCELLED',
      }),
    );
    expect(await WebhookEvent.findOne({ provider: 'asaas', eventId: 'evt_payment_deleted_existing_order' }).lean()).toEqual(
      expect.objectContaining({
        status: 'processed',
        eventType: 'PAYMENT_DELETED',
        providerResourceId: 'pay_123',
        resourceId: order._id.toString(),
      }),
    );
  });

  it('reconciles PAYMENT_DELETED when the Order exists but the local Payment was not stored yet', async () => {
    const { order } = await createAsaasOrderFixture();
    const externalReference = `tenant:${order.businessId.toString()}:order:${order._id.toString()}`;
    await Payment.deleteMany({ provider: 'asaas', providerPaymentId: 'pay_123' });

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_deleted_without_payment',
        event: 'PAYMENT_DELETED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    expect(response.status).toBe(204);
    expect(asaasServiceMock.getAsaasPayment).not.toHaveBeenCalled();
    expect(await Payment.findOne({ provider: 'asaas', providerPaymentId: 'pay_123' }).lean()).toEqual(
      expect.objectContaining({
        businessId: order.businessId,
        orderId: order._id,
        status: 'cancelled',
        providerStatus: 'CANCELLED',
      }),
    );
    expect(await TenantLedgerEntry.countDocuments({ businessId: order.businessId })).toBe(0);

    const updatedOrder = await Order.findById(order._id).lean();
    expect(updatedOrder.payment.status).toBe('cancelled');
    expect(await WebhookEvent.findOne({ provider: 'asaas', eventId: 'evt_payment_deleted_without_payment' }).lean()).toEqual(
      expect.objectContaining({
        status: 'processed',
        providerResourceId: 'pay_123',
      }),
    );
  });

  it('reconciles PAYMENT_DELETED on the local Payment when the Order no longer exists', async () => {
    const { business, order } = await createAsaasOrderFixture();
    const externalReference = `tenant:${business._id.toString()}:order:${order._id.toString()}`;
    await Order.deleteOne({ _id: order._id });

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_deleted_without_order',
        event: 'PAYMENT_DELETED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    expect(response.status).toBe(204);
    expect(asaasServiceMock.getAsaasPayment).not.toHaveBeenCalled();

    expect(await Payment.findOne({ provider: 'asaas', providerPaymentId: 'pay_123' }).lean()).toEqual(
      expect.objectContaining({
        businessId: business._id,
        orderId: order._id,
        status: 'cancelled',
        providerStatus: 'DELETED',
      }),
    );
    expect(await TenantLedgerEntry.countDocuments({ businessId: business._id })).toBe(0);
    expect(await WebhookEvent.findOne({ provider: 'asaas', eventId: 'evt_payment_deleted_without_order' }).lean()).toEqual(
      expect.objectContaining({
        status: 'processed',
        resourceType: 'payment',
      }),
    );
  });

  it('ignores authenticated orphan events with invalid externalReference idempotently', async () => {
    const payload = {
      id: 'evt_payment_invalid_external_reference',
      event: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_orphan_invalid_reference',
        externalReference: 'legacy-sandbox-charge',
      },
    };

    const firstResponse = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send(payload);
    const secondResponse = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send(payload);

    expect(firstResponse.status).toBe(204);
    expect(secondResponse.status).toBe(204);
    expect(asaasServiceMock.getAsaasPayment).not.toHaveBeenCalled();
    expect(await WebhookEvent.countDocuments({ provider: 'asaas', eventId: 'evt_payment_invalid_external_reference' })).toBe(1);
    expect(await WebhookEvent.findOne({ provider: 'asaas', eventId: 'evt_payment_invalid_external_reference' }).lean()).toEqual(
      expect.objectContaining({
        status: 'ignored',
        errorCode: 'invalid_external_reference',
      }),
    );
  });

  it('updates Payment but does not create ledger entries when a received payment has no local Order', async () => {
    const { business, order } = await createAsaasOrderFixture();
    const externalReference = `tenant:${business._id.toString()}:order:${order._id.toString()}`;
    await Order.deleteOne({ _id: order._id });

    asaasServiceMock.getAsaasPayment.mockResolvedValue({
      id: 'pay_123',
      status: 'RECEIVED',
      value: 79.9,
      externalReference,
      confirmedDate: '2026-06-01T18:10:00.000Z',
    });

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_payment_received_without_order',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference,
        },
      });

    expect(response.status).toBe(204);
    expect(asaasServiceMock.getAsaasPayment).toHaveBeenCalledTimes(1);
    expect(await Payment.findOne({ provider: 'asaas', providerPaymentId: 'pay_123' }).lean()).toEqual(
      expect.objectContaining({
        businessId: business._id,
        orderId: order._id,
        status: 'paid',
        providerStatus: 'RECEIVED',
      }),
    );
    expect(await TenantLedgerEntry.countDocuments({ businessId: business._id })).toBe(0);
    expect(await WebhookEvent.findOne({ provider: 'asaas', eventId: 'evt_payment_received_without_order' }).lean()).toEqual(
      expect.objectContaining({
        status: 'processed',
        resourceType: 'payment',
      }),
    );
  });

  it('ignores cross-tenant updates when Asaas reports another tenant in externalReference', async () => {
    const { business, order } = await createAsaasOrderFixture();
    const otherBusiness = await Business.create({
      name: 'Outro tenant',
      slug: 'outro-tenant',
      status: 'active',
      seo: {
        title: 'Outro tenant',
        description: 'Usado para validar isolamento do webhook.',
      },
    });

    asaasServiceMock.getAsaasPayment.mockResolvedValue({
      id: 'pay_123',
      status: 'RECEIVED',
      value: 79.9,
      externalReference: `tenant:${otherBusiness._id.toString()}:order:${order._id.toString()}`,
      confirmedDate: '2026-06-01T18:10:00.000Z',
    });

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'asaas-webhook-token')
      .send({
        id: 'evt_cross_tenant',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference: `tenant:${business._id.toString()}:order:${order._id.toString()}`,
        },
      });

    expect(response.status).toBe(204);
    const untouchedOrder = await Order.findById(order._id).lean();
    expect(untouchedOrder.payment.status).toBe('pending');
    expect(await TenantLedgerEntry.countDocuments({ businessId: business._id })).toBe(0);
    expect(await WebhookEvent.findOne({ provider: 'asaas', eventId: 'evt_cross_tenant' }).lean()).toEqual(
      expect.objectContaining({
        status: 'ignored',
        errorCode: 'provider_scope_mismatch',
        providerResourceId: 'pay_123',
      }),
    );
  });
});
