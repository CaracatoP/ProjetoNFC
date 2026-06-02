import { describe, expect, it } from 'vitest';
import { businessPaymentSettingsSchema } from '../../../shared/schemas/business.js';
import { Business } from './Business.js';
import { Order } from './Order.js';
import { SystemSetting } from './SystemSetting.js';

describe('payment models and schemas', () => {
  it('normalizes asaas payment settings without exposing encrypted secrets', () => {
    const business = new Business({
      name: 'Loja Teste',
      slug: 'loja-teste',
      seo: { title: 'Loja Teste', description: 'Descricao' },
      paymentSettings: {
        provider: 'asaas',
        asaas: {
          enabled: true,
          subaccountId: 'sub_123',
          walletId: 'wallet_123',
          apiKeyEncrypted: 'enc-api',
          webhookAuthTokenEncrypted: 'enc-webhook',
          accountEmail: 'financeiro@loja.com',
          accountName: 'Loja Teste LTDA',
          status: 'active',
        },
        split: {
          enabled: true,
          platformFeePercent: 5,
          platformWalletId: 'wallet_platform',
          mode: 'percentage',
          inheritsGlobal: false,
        },
      },
    });

    const json = business.toJSON();

    expect(json.paymentSettings.provider).toBe('asaas');
    expect(json.paymentSettings.asaas).toEqual(
      expect.objectContaining({
        enabled: true,
        subaccountId: 'sub_123',
        walletId: 'wallet_123',
        accountEmail: 'financeiro@loja.com',
        accountName: 'Loja Teste LTDA',
        status: 'active',
        hasApiKey: true,
        hasWebhookAuthToken: true,
        connected: true,
      }),
    );
    expect(json.paymentSettings.asaas.apiKeyEncrypted).toBeUndefined();
    expect(json.paymentSettings.asaas.webhookAuthTokenEncrypted).toBeUndefined();
    expect(json.paymentSettings.split).toEqual(
      expect.objectContaining({
        enabled: true,
        platformFeePercent: 5,
        platformWalletId: 'wallet_platform',
        mode: 'percentage',
        inheritsGlobal: false,
      }),
    );
  });

  it('keeps manual as the default provider and exposes safe defaults for asaas and split', () => {
    const business = new Business({
      name: 'Manual Store',
      slug: 'manual-store',
      seo: { title: 'Manual Store', description: 'Descricao' },
    });

    const json = business.toJSON();
    const parsed = businessPaymentSettingsSchema.parse(json.paymentSettings);

    expect(json.paymentSettings.provider).toBe('manual');
    expect(parsed.asaas).toEqual(
      expect.objectContaining({
        enabled: false,
        subaccountId: '',
        walletId: '',
        accountEmail: '',
        accountName: '',
        status: 'not_connected',
        hasApiKey: false,
        hasWebhookAuthToken: false,
        connected: false,
      }),
    );
    expect(parsed.split).toEqual(
      expect.objectContaining({
        enabled: false,
        platformFeePercent: 0,
        platformWalletId: '',
        mode: 'percentage',
        inheritsGlobal: true,
      }),
    );
  });

  it('normalizes asaas payment snapshots and payment events on orders without dropping legacy fields', () => {
    const order = new Order({
      customerName: 'Cliente',
      customerPhone: '5511999999999',
      businessId: '665cb4a9e1f0a1b2c3d4e5f6',
      items: [
        {
          name: 'Produto',
          quantity: 1,
          unitPrice: 119.9,
          measurementUnit: 'unit',
          displayQuantity: '1 unidade',
          itemTotal: 119.9,
        },
      ],
      total: 119.9,
      payment: {
        method: 'pix',
        provider: 'asaas',
        status: 'pending',
        amount: 119.9,
        providerPaymentId: 'pay_123',
        providerCustomerId: 'cus_123',
        invoiceUrl: 'https://asaas.test/invoice/pay_123',
        bankSlipUrl: 'https://asaas.test/boleto/pay_123',
        pixCopyPaste: '000201010212',
        pixQrCode: 'data:image/png;base64,abc123',
        pixQrCodeUrl: 'https://asaas.test/qr/pay_123.png',
        platformFeeAmount: 5.99,
        tenantNetAmount: 113.91,
        updatedAt: '2026-06-02T12:00:00.000Z',
      },
      paymentEvents: [
        {
          type: 'charge_created',
          provider: 'asaas',
          status: 'pending',
          message: 'Charge created',
          providerEvent: 'PAYMENT_CREATED',
          providerPaymentId: 'pay_123',
          occurredAt: '2026-06-02T12:00:01.000Z',
          meta: { source: 'test' },
        },
      ],
    });

    const json = order.toJSON();

    expect(json.payment).toEqual(
      expect.objectContaining({
        method: 'pix',
        provider: 'asaas',
        status: 'pending',
        amount: 119.9,
        providerPaymentId: 'pay_123',
        providerCustomerId: 'cus_123',
        invoiceUrl: 'https://asaas.test/invoice/pay_123',
        bankSlipUrl: 'https://asaas.test/boleto/pay_123',
        pixCopyPaste: '000201010212',
        pixQrCode: 'data:image/png;base64,abc123',
        pixQrCodeUrl: 'https://asaas.test/qr/pay_123.png',
        platformFeeAmount: 5.99,
        tenantNetAmount: 113.91,
      }),
    );
    expect(json.payment.providerPreferenceId).toBe('');
    expect(json.payment.checkoutUrl).toBe('');
    expect(json.paymentEvents).toEqual([
      expect.objectContaining({
        type: 'charge_created',
        provider: 'asaas',
        status: 'pending',
        providerEvent: 'PAYMENT_CREATED',
        providerPaymentId: 'pay_123',
        meta: { source: 'test' },
      }),
    ]);
  });

  it('creates the system setting model with key and mixed value support', () => {
    const setting = new SystemSetting({
      key: 'finance:asaas',
      value: {
        platformWalletId: 'wallet_platform',
        defaultPlatformFeePercent: 5,
      },
    });

    const json = setting.toJSON();

    expect(json.key).toBe('finance:asaas');
    expect(json.value).toEqual({
      platformWalletId: 'wallet_platform',
      defaultPlatformFeePercent: 5,
    });
  });
});
