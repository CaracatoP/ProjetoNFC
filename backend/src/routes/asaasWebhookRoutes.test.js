import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

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
let subscribeToTenantUpdates;
let encryptSecret;
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
    process.env.ASAAS_WEBHOOK_AUTH_TOKEN = 'asaas-webhook-token';

    ({ connectDatabase, disconnectDatabase } = await import('../config/database.js'));
    ({ seedDemoData } = await import('../utils/seedDemoData.js'));
    ({ Business } = await import('../models/Business.js'));
    ({ Order } = await import('../models/Order.js'));
    ({ subscribeToTenantUpdates } = await import('../services/tenantRealtimeService.js'));
    ({ encryptSecret } = await import('../utils/secretCrypto.js'));
    ({ default: app } = await import('../app.js'));

    await connectDatabase();
  });

  beforeEach(async () => {
    await seedDemoData({ reset: true });
    asaasServiceMock.getAsaasPayment.mockReset();
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
  });

  async function createAsaasOrderFixture() {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const encryptedApiKey = encryptSecret('$aact_hmlg_sub_key');

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
            apiKeyEncrypted: encryptedApiKey,
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
        status: 'pending',
        amount: 79.9,
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

    return { business, order };
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
    unsubscribe();
  });

  it('rejects the webhook when the Asaas auth token header is invalid', async () => {
    const { business, order } = await createAsaasOrderFixture();

    const response = await request(app)
      .post('/api/webhooks/asaas')
      .set('asaas-access-token', 'invalid-token')
      .send({
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
  });

  it('rejects cross-tenant updates when Asaas reports another tenant in externalReference', async () => {
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
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_123',
          externalReference: `tenant:${business._id.toString()}:order:${order._id.toString()}`,
        },
      });

    expect(response.status).toBe(404);
    const untouchedOrder = await Order.findById(order._id).lean();
    expect(untouchedOrder.payment.status).toBe('pending');
  });
});
