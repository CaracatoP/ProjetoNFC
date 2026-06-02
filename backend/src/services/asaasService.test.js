import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

let buildAsaasExternalReference;
let parseAsaasExternalReference;
let buildAsaasSplitRules;
let createAsaasSubaccount;
let createAsaasCustomer;
let createAsaasPaymentCharge;
let getAsaasPixQrCode;

describe('asaasService', () => {
  beforeAll(async () => {
    process.env.ASAAS_ENV = 'sandbox';
    process.env.ASAAS_API_KEY = '$aact_hmlg_root_key';
    vi.stubGlobal('fetch', fetchMock);

    ({
      buildAsaasExternalReference,
      parseAsaasExternalReference,
      buildAsaasSplitRules,
      createAsaasSubaccount,
      createAsaasCustomer,
      createAsaasPaymentCharge,
      getAsaasPixQrCode,
    } = await import('./asaasService.js'));
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('builds and parses a multi-tenant external reference for Asaas charges', () => {
    const externalReference = buildAsaasExternalReference(
      '66554433221100ffeeddccbb',
      '66554433221100ffeeddccaa',
    );

    expect(externalReference).toBe(
      'tenant:66554433221100ffeeddccbb:order:66554433221100ffeeddccaa',
    );
    expect(parseAsaasExternalReference(externalReference)).toEqual({
      businessId: '66554433221100ffeeddccbb',
      orderId: '66554433221100ffeeddccaa',
    });
    expect(parseAsaasExternalReference('invalid-ref')).toBeNull();
  });

  it('builds split rules using only the platform wallet and leaves the remainder with the issuer', () => {
    expect(
      buildAsaasSplitRules({
        total: 100,
        platformFeePercent: 5,
        platformWalletId: 'wallet_platform',
      }),
    ).toEqual({
      platformFeeAmount: 5,
      tenantNetAmount: 95,
      split: [{ walletId: 'wallet_platform', percentualValue: 5 }],
    });
  });

  it('creates a subaccount using the root Asaas API key and returns apiKey and walletId', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'subacc_123',
        walletId: 'wallet_sub',
        apiKey: '$aact_hmlg_sub_key',
      }),
    });

    const result = await createAsaasSubaccount({
      name: 'Casa do Preto LTDA',
      email: 'financeiro@casadopreto.com',
      cpfCnpj: '12345678000199',
      mobilePhone: '11999999999',
      incomeValue: 50000,
      address: 'Rua Central',
      addressNumber: '100',
      province: 'Centro',
      postalCode: '01001000',
    });

    expect(result).toEqual({
      id: 'subacc_123',
      walletId: 'wallet_sub',
      apiKey: '$aact_hmlg_sub_key',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/accounts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          access_token: '$aact_hmlg_root_key',
          'content-type': 'application/json',
        }),
      }),
    );
  });

  it('creates a Pix charge with externalReference and split using the tenant subaccount key', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'pay_123',
        invoiceUrl: 'https://sandbox.asaas.com/i/pay_123',
        status: 'PENDING',
      }),
    });

    const result = await createAsaasPaymentCharge({
      apiKey: '$aact_hmlg_sub_key',
      charge: {
        customer: 'cus_123',
        billingType: 'PIX',
        value: 100,
        dueDate: '2026-06-02',
        description: 'Pedido TapLink',
        externalReference: 'tenant:tenant123:order:order123',
        split: [{ walletId: 'wallet_platform', percentualValue: 5 }],
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'pay_123',
        invoiceUrl: 'https://sandbox.asaas.com/i/pay_123',
        status: 'PENDING',
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/payments',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          access_token: '$aact_hmlg_sub_key',
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          customer: 'cus_123',
          billingType: 'PIX',
          value: 100,
          dueDate: '2026-06-02',
          description: 'Pedido TapLink',
          externalReference: 'tenant:tenant123:order:order123',
          split: [{ walletId: 'wallet_platform', percentualValue: 5 }],
        }),
      }),
    );
  });

  it('creates a customer in the tenant subaccount before issuing the charge', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'cus_123',
        name: 'Marcos',
      }),
    });

    const result = await createAsaasCustomer({
      apiKey: '$aact_hmlg_sub_key',
      customer: {
        name: 'Marcos',
        mobilePhone: '11999999999',
        email: 'marcos@example.com',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'cus_123',
        name: 'Marcos',
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/customers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          access_token: '$aact_hmlg_sub_key',
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          name: 'Marcos',
          mobilePhone: '11999999999',
          email: 'marcos@example.com',
        }),
      }),
    );
  });

  it('fetches the Pix QR Code payload for a created charge', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        payload: '000201010212',
        encodedImage: 'data:image/png;base64,abc123',
      }),
    });

    const result = await getAsaasPixQrCode({
      apiKey: '$aact_hmlg_sub_key',
      paymentId: 'pay_123',
    });

    expect(result).toEqual({
      payload: '000201010212',
      encodedImage: 'data:image/png;base64,abc123',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api-sandbox.asaas.com/v3/payments/pay_123/pixQrCode',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          access_token: '$aact_hmlg_sub_key',
        }),
      }),
    );
  });
});
