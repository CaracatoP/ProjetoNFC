import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

const webhookValidatorMock = vi.hoisted(() => ({
  validate: vi.fn(),
}));

const mercadoPagoServiceMock = vi.hoisted(() => ({
  createMercadoPagoCheckoutPreference: vi.fn(),
  getMercadoPagoPayment: vi.fn(),
}));

vi.mock('mercadopago', () => ({
  WebhookSignatureValidator: {
    validate: webhookValidatorMock.validate,
  },
  InvalidWebhookSignatureError: class InvalidWebhookSignatureError extends Error {},
}));

vi.mock('../services/mercadoPagoService.js', () => ({
  createMercadoPagoCheckoutPreference: mercadoPagoServiceMock.createMercadoPagoCheckoutPreference,
  getMercadoPagoPayment: mercadoPagoServiceMock.getMercadoPagoPayment,
  parseMercadoPagoExternalReference: (value) => {
    const match = /^tenant:([^:]+):order:([^:]+)$/i.exec(String(value || '').trim());

    if (!match) {
      return null;
    }

    return {
      businessId: match[1],
      orderId: match[2],
    };
  },
}));

let app;
let connectDatabase;
let disconnectDatabase;
let seedDemoData;
let Business;
let Order;
let subscribeToTenantUpdates;
let encryptSecret;
let mongoServer;

describe('Mercado Pago webhook routes', () => {
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
    webhookValidatorMock.validate.mockReset();
    mercadoPagoServiceMock.createMercadoPagoCheckoutPreference.mockReset();
    mercadoPagoServiceMock.getMercadoPagoPayment.mockReset();
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
  });

  async function createMercadoPagoOrderFixture() {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    const encryptedAccessToken = encryptSecret('APP_USR-test-access-token');
    const encryptedWebhookSecret = encryptSecret('mp-webhook-secret');

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
            accessTokenEncrypted: encryptedAccessToken,
            webhookSecretEncrypted: encryptedWebhookSecret,
            accountEmail: 'seller@example.com',
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
        method: 'credit_card',
        provider: 'mercado_pago',
        status: 'pending',
        amount: 79.9,
        providerPreferenceId: 'pref_test_123',
        checkoutUrl: 'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_test_123',
        updatedAt: new Date('2026-06-01T18:00:00.000Z'),
      },
    });

    return { business, order };
  }

  it('marks the tenant order as paid when Mercado Pago confirms an approved payment', async () => {
    const listener = vi.fn();
    const { business, order } = await createMercadoPagoOrderFixture();
    const unsubscribe = subscribeToTenantUpdates({ slug: business.slug }, listener);

    webhookValidatorMock.validate.mockReturnValue(undefined);
    mercadoPagoServiceMock.getMercadoPagoPayment.mockResolvedValue({
      providerPaymentId: '99887766',
      providerPreferenceId: 'pref_test_123',
      externalReference: `tenant:${business._id.toString()}:order:${order._id.toString()}`,
      method: 'credit_card',
      status: 'paid',
      rawStatus: 'approved',
      rawStatusDetail: 'accredited',
      amount: 79.9,
      paidAt: new Date('2026-06-01T18:10:00.000Z'),
    });

    const response = await request(app)
      .post('/api/webhooks/mercado-pago')
      .query({
        businessId: business._id.toString(),
        orderId: order._id.toString(),
        'data.id': '99887766',
      })
      .set('x-signature', 'ts=1717265400,v1=fake')
      .set('x-request-id', 'req-123')
      .send({
        type: 'payment',
        action: 'payment.updated',
        data: { id: '99887766' },
      });

    expect(response.status).toBe(204);
    const updatedOrder = await Order.findById(order._id).lean();
    expect(updatedOrder.payment).toEqual(
      expect.objectContaining({
        provider: 'mercado_pago',
        status: 'paid',
        providerPaymentId: '99887766',
        providerPreferenceId: 'pref_test_123',
      }),
    );
    expect(updatedOrder.payment.paidAt).toBeTruthy();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: business._id.toString(),
        slug: business.slug,
        kind: 'order_payment_updated',
      }),
    );
    unsubscribe();
  });

  it('marks the tenant order as failed when Mercado Pago reports a rejected payment', async () => {
    const { business, order } = await createMercadoPagoOrderFixture();
    webhookValidatorMock.validate.mockReturnValue(undefined);
    mercadoPagoServiceMock.getMercadoPagoPayment.mockResolvedValue({
      providerPaymentId: '99887766',
      providerPreferenceId: 'pref_test_123',
      externalReference: `tenant:${business._id.toString()}:order:${order._id.toString()}`,
      method: 'credit_card',
      status: 'failed',
      rawStatus: 'rejected',
      rawStatusDetail: 'cc_rejected_other_reason',
      amount: 79.9,
      paidAt: null,
    });

    const response = await request(app)
      .post('/api/webhooks/mercado-pago')
      .query({
        businessId: business._id.toString(),
        orderId: order._id.toString(),
        'data.id': '99887766',
      })
      .set('x-signature', 'ts=1717265400,v1=fake')
      .set('x-request-id', 'req-456')
      .send({
        type: 'payment',
        action: 'payment.updated',
        data: { id: '99887766' },
      });

    expect(response.status).toBe(204);
    const updatedOrder = await Order.findById(order._id).lean();
    expect(updatedOrder.payment).toEqual(
      expect.objectContaining({
        status: 'failed',
        providerPaymentId: '99887766',
      }),
    );
  });

  it('keeps the webhook idempotent when the same approved payment notification is delivered twice', async () => {
    const listener = vi.fn();
    const { business, order } = await createMercadoPagoOrderFixture();
    const unsubscribe = subscribeToTenantUpdates({ slug: business.slug }, listener);

    webhookValidatorMock.validate.mockReturnValue(undefined);
    mercadoPagoServiceMock.getMercadoPagoPayment.mockResolvedValue({
      providerPaymentId: '99887766',
      providerPreferenceId: 'pref_test_123',
      externalReference: `tenant:${business._id.toString()}:order:${order._id.toString()}`,
      method: 'credit_card',
      status: 'paid',
      rawStatus: 'approved',
      rawStatusDetail: 'accredited',
      amount: 79.9,
      paidAt: new Date('2026-06-01T18:10:00.000Z'),
    });

    const firstResponse = await request(app)
      .post('/api/webhooks/mercado-pago')
      .query({
        businessId: business._id.toString(),
        orderId: order._id.toString(),
        'data.id': '99887766',
      })
      .set('x-signature', 'ts=1717265400,v1=fake')
      .set('x-request-id', 'req-789')
      .send({
        type: 'payment',
        action: 'payment.updated',
        data: { id: '99887766' },
      });

    const paidOnce = await Order.findById(order._id).lean();
    const firstPaidAt = paidOnce.payment.paidAt;

    const secondResponse = await request(app)
      .post('/api/webhooks/mercado-pago')
      .query({
        businessId: business._id.toString(),
        orderId: order._id.toString(),
        'data.id': '99887766',
      })
      .set('x-signature', 'ts=1717265400,v1=fake')
      .set('x-request-id', 'req-790')
      .send({
        type: 'payment',
        action: 'payment.updated',
        data: { id: '99887766' },
      });

    const paidTwice = await Order.findById(order._id).lean();

    expect(firstResponse.status).toBe(204);
    expect(secondResponse.status).toBe(204);
    expect(paidTwice.payment.status).toBe('paid');
    expect(paidTwice.payment.paidAt?.toISOString?.() || String(paidTwice.payment.paidAt)).toBe(
      firstPaidAt?.toISOString?.() || String(firstPaidAt),
    );
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('rejects the webhook when the Mercado Pago signature is invalid', async () => {
    const { business, order } = await createMercadoPagoOrderFixture();
    webhookValidatorMock.validate.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    const response = await request(app)
      .post('/api/webhooks/mercado-pago')
      .query({
        businessId: business._id.toString(),
        orderId: order._id.toString(),
        'data.id': '99887766',
      })
      .set('x-signature', 'ts=1717265400,v1=invalid')
      .set('x-request-id', 'req-invalid-signature')
      .send({
        type: 'payment',
        action: 'payment.updated',
        data: { id: '99887766' },
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('mercado_pago_webhook_invalid_signature');
    expect(mercadoPagoServiceMock.getMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it('rejects the webhook update when Mercado Pago returns an external_reference for another tenant/order', async () => {
    const { business, order } = await createMercadoPagoOrderFixture();
    const otherBusiness = await Business.create({
      name: 'Outro tenant',
      slug: 'outro-tenant',
      status: 'active',
      seo: {
        title: 'Outro tenant',
        description: 'Usado para validar isolamento do webhook.',
      },
    });

    webhookValidatorMock.validate.mockReturnValue(undefined);
    mercadoPagoServiceMock.getMercadoPagoPayment.mockResolvedValue({
      providerPaymentId: '99887766',
      providerPreferenceId: 'pref_test_123',
      externalReference: `tenant:${otherBusiness._id.toString()}:order:${order._id.toString()}`,
      method: 'credit_card',
      status: 'paid',
      rawStatus: 'approved',
      rawStatusDetail: 'accredited',
      amount: 79.9,
      paidAt: new Date('2026-06-01T18:10:00.000Z'),
    });

    const response = await request(app)
      .post('/api/webhooks/mercado-pago')
      .query({
        businessId: business._id.toString(),
        orderId: order._id.toString(),
        'data.id': '99887766',
      })
      .set('x-signature', 'ts=1717265400,v1=fake')
      .set('x-request-id', 'req-999')
      .send({
        type: 'payment',
        action: 'payment.updated',
        data: { id: '99887766' },
      });

    expect(response.status).toBe(404);
    const untouchedOrder = await Order.findById(order._id).lean();
    expect(untouchedOrder.payment.status).toBe('pending');
  });
});
