import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sdkMocks = vi.hoisted(() => ({
  preferenceCreate: vi.fn(),
  paymentGet: vi.fn(),
}));

vi.mock('mercadopago', () => ({
  MercadoPagoConfig: class MercadoPagoConfig {
    constructor(config) {
      this.config = config;
    }
  },
  Preference: class Preference {
    constructor(client) {
      this.client = client;
    }

    create(payload) {
      return sdkMocks.preferenceCreate(payload);
    }
  },
  Payment: class Payment {
    constructor(client) {
      this.client = client;
    }

    get(payload) {
      return sdkMocks.paymentGet(payload);
    }
  },
}));

let buildMercadoPagoExternalReference;
let parseMercadoPagoExternalReference;
let createMercadoPagoCheckoutPreference;
let getMercadoPagoPayment;
let encryptSecret;

describe('mercadoPagoService', () => {
  beforeAll(async () => {
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY = '12345678901234567890123456789012';
    process.env.PUBLIC_SITE_BASE_URL = 'http://localhost:5173';
    process.env.API_PUBLIC_BASE_URL = 'http://localhost:4000';

    ({
      buildMercadoPagoExternalReference,
      parseMercadoPagoExternalReference,
      createMercadoPagoCheckoutPreference,
      getMercadoPagoPayment,
    } = await import('./mercadoPagoService.js'));
    ({ encryptSecret } = await import('../utils/secretCrypto.js'));
  });

  beforeEach(() => {
    sdkMocks.preferenceCreate.mockReset();
    sdkMocks.paymentGet.mockReset();
  });

  it('builds and parses a multi-tenant external_reference', () => {
    const externalReference = buildMercadoPagoExternalReference(
      '66554433221100ffeeddccbb',
      '66554433221100ffeeddccaa',
    );

    expect(externalReference).toBe(
      'tenant:66554433221100ffeeddccbb:order:66554433221100ffeeddccaa',
    );
    expect(parseMercadoPagoExternalReference(externalReference)).toEqual({
      businessId: '66554433221100ffeeddccbb',
      orderId: '66554433221100ffeeddccaa',
    });
    expect(parseMercadoPagoExternalReference('invalid-ref')).toBeNull();
  });

  it('creates a Checkout Pro preference with tenant/order context and returns the checkout URL', async () => {
    sdkMocks.preferenceCreate.mockResolvedValue({
      id: 'pref_test_123',
      init_point: 'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_test_123',
    });

    const encryptedToken = encryptSecret('APP_USR-test-access-token');
    const result = await createMercadoPagoCheckoutPreference({
      business: {
        _id: '66554433221100ffeeddccbb',
        slug: 'casa-do-preto',
        name: 'Casa do Preto',
      },
      order: {
        _id: '66554433221100ffeeddccaa',
        customerName: 'Marcos',
        total: 79.9,
        items: [
          {
            name: 'Picanha',
            displayQuantity: '400g',
            itemTotal: 79.9,
          },
        ],
      },
      paymentMethod: 'credit_card',
      mercadoPagoSettings: {
        enabled: true,
        publicKey: 'APP_USR-public',
        accessTokenEncrypted: encryptedToken,
      },
    });

    expect(result).toEqual({
      preferenceId: 'pref_test_123',
      checkoutUrl: 'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_test_123',
      externalReference: 'tenant:66554433221100ffeeddccbb:order:66554433221100ffeeddccaa',
    });
    expect(sdkMocks.preferenceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          external_reference: 'tenant:66554433221100ffeeddccbb:order:66554433221100ffeeddccaa',
          notification_url:
            'http://localhost:4000/api/webhooks/mercado-pago?businessId=66554433221100ffeeddccbb&orderId=66554433221100ffeeddccaa',
          back_urls: {
            success:
              'http://localhost:5173/site/casa-do-preto/catalog?paymentReturn=success&orderId=66554433221100ffeeddccaa',
            failure:
              'http://localhost:5173/site/casa-do-preto/catalog?paymentReturn=failure&orderId=66554433221100ffeeddccaa',
            pending:
              'http://localhost:5173/site/casa-do-preto/catalog?paymentReturn=pending&orderId=66554433221100ffeeddccaa',
          },
          payment_methods: expect.objectContaining({
            excluded_payment_types: expect.arrayContaining([{ id: 'pix' }, { id: 'debit_card' }]),
          }),
        }),
      }),
    );
  });

  it('maps approved Mercado Pago payments into the internal payment snapshot shape', async () => {
    sdkMocks.paymentGet.mockResolvedValue({
      id: 99887766,
      status: 'approved',
      status_detail: 'accredited',
      payment_type_id: 'pix',
      transaction_amount: 79.9,
      date_approved: '2026-06-01T20:00:00.000Z',
      external_reference: 'tenant:66554433221100ffeeddccbb:order:66554433221100ffeeddccaa',
      order: {
        id: 'pref_test_123',
      },
    });

    const encryptedToken = encryptSecret('APP_USR-test-access-token');
    const result = await getMercadoPagoPayment({
      providerPaymentId: '99887766',
      mercadoPagoSettings: {
        enabled: true,
        accessTokenEncrypted: encryptedToken,
      },
    });

    expect(result).toEqual({
      providerPaymentId: '99887766',
      providerPreferenceId: 'pref_test_123',
      externalReference: 'tenant:66554433221100ffeeddccbb:order:66554433221100ffeeddccaa',
      method: 'pix',
      status: 'paid',
      rawStatus: 'approved',
      rawStatusDetail: 'accredited',
      amount: 79.9,
      paidAt: new Date('2026-06-01T20:00:00.000Z'),
    });
  });
});
