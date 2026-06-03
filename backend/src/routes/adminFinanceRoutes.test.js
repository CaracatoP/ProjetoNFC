import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { hashPassword } from '../utils/password.js';

const asaasServiceMock = vi.hoisted(() => ({
  createAsaasSubaccount: vi.fn(),
}));

vi.mock('../services/asaasService.js', async () => {
  const actual = await vi.importActual('../services/asaasService.js');

  return {
    ...actual,
    createAsaasSubaccount: asaasServiceMock.createAsaasSubaccount,
  };
});

let app;
let connectDatabase;
let disconnectDatabase;
let seedDemoData;
let User;
let Business;
let SystemSetting;
let decryptSecret;
let encryptSecret;
let envConfig;
let mongoServer;
let superAdminToken;

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

describe('Admin finance routes', () => {
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
    process.env.ASAAS_API_KEY = '$aact_hmlg_root_key';
    process.env.ASAAS_ENV = 'sandbox';
    process.env.ASAAS_WEBHOOK_AUTH_TOKEN = 'asaas-webhook-token';

    ({ connectDatabase, disconnectDatabase } = await import('../config/database.js'));
    ({ seedDemoData } = await import('../utils/seedDemoData.js'));
    ({ User } = await import('../models/User.js'));
    ({ Business } = await import('../models/Business.js'));
    ({ SystemSetting } = await import('../models/SystemSetting.js'));
    ({ decryptSecret, encryptSecret } = await import('../utils/secretCrypto.js'));
    ({ env: envConfig } = await import('../config/env.js'));
    ({ default: app } = await import('../app.js'));

    await connectDatabase();
  });

  beforeEach(async () => {
    await seedDemoData({ reset: true });
    await User.deleteMany({});
    await SystemSetting.deleteMany({});
    asaasServiceMock.createAsaasSubaccount.mockReset();
    envConfig.asaasApiKey = '$aact_hmlg_root_key';
    envConfig.asaasWebhookAuthToken = 'asaas-webhook-token';

    const loginResponse = await request(app).post('/api/admin/auth/login').send({
      username: 'admin@nfc.local',
      password: 'admin123456',
    });

    superAdminToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
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

  it('allows level 0 to read platform asaas settings safely', async () => {
    await SystemSetting.create({
      key: 'finance:asaas',
      value: {
        platformWalletId: 'wallet_platform_123',
        defaultPlatformFeePercent: 5,
        asaasApiKey: 'should-not-leak',
        webhookAuthToken: 'should-not-leak',
      },
    });

    const response = await request(app)
      .get('/api/admin/finance/settings')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      environment: 'sandbox',
      rootApiKeyConfigured: true,
      platformWalletId: 'wallet_platform_123',
      defaultPlatformFeePercent: 5,
      webhookUrl: 'http://localhost:4000/api/webhooks/asaas',
      integrationStatus: 'configured',
      summary: {
        platformReady: true,
      },
    });
    expect(response.body.data.asaasApiKey).toBeUndefined();
    expect(response.body.data.asaasWebhookAuthToken).toBeUndefined();
  });

  it('blocks level 1 from reading finance settings', async () => {
    const levelOneToken = await createInternalAdminWithoutLegacyRoles();

    const response = await request(app)
      .get('/api/admin/finance/settings')
      .set('Authorization', `Bearer ${levelOneToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('finance_forbidden');
  });

  it('blocks level 1 from updating split defaults', async () => {
    const levelOneToken = await createInternalAdminWithoutLegacyRoles();

    const response = await request(app)
      .patch('/api/admin/finance/settings')
      .set('Authorization', `Bearer ${levelOneToken}`)
      .send({
        platformWalletId: 'wallet_platform_999',
        defaultPlatformFeePercent: 10,
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('finance_forbidden');
    expect(await SystemSetting.countDocuments()).toBe(0);
  });

  it('allows level 0 to update split defaults without leaking secrets', async () => {
    const response = await request(app)
      .patch('/api/admin/finance/settings')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        platformWalletId: 'wallet_platform_999',
        defaultPlatformFeePercent: 10,
        environment: 'production',
        rootApiKeyConfigured: false,
        asaasApiKey: 'should-not-persist',
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      environment: 'sandbox',
      rootApiKeyConfigured: true,
      platformWalletId: 'wallet_platform_999',
      defaultPlatformFeePercent: 10,
      webhookUrl: 'http://localhost:4000/api/webhooks/asaas',
      integrationStatus: 'configured',
      summary: {
        platformReady: true,
      },
    });

    const persistedSettings = await SystemSetting.findOne({ key: 'finance:asaas' }).lean();

    expect(persistedSettings.value).toEqual({
      platformWalletId: 'wallet_platform_999',
      defaultPlatformFeePercent: 10,
    });
    expect(persistedSettings.value.asaasApiKey).toBeUndefined();
  });

  it('returns tenant finance settings safely without leaking the subaccount api key', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });

    await SystemSetting.create({
      key: 'finance:asaas',
      value: {
        platformWalletId: 'wallet_platform_123',
        defaultPlatformFeePercent: 5,
      },
    });
    await Business.updateOne(
      { _id: business._id },
      {
        paymentSettings: {
          enabled: true,
          provider: 'asaas',
          methods: {
            pix: true,
            creditCard: true,
            debitCard: true,
            cashOnPickup: true,
            cashOnDelivery: true,
          },
          asaas: {
            enabled: true,
            subaccountId: 'subacc_123',
            walletId: 'wallet_sub_123',
            apiKeyEncrypted: encryptSecret('$aact_hmlg_sub_key'),
            accountEmail: 'seller@example.com',
            accountName: 'Casa do Preto',
            status: 'active',
          },
          split: {
            enabled: false,
            inheritsGlobal: true,
            platformFeePercent: 0,
          },
        },
      },
    );

    const response = await request(app)
      .get(`/api/admin/finance/businesses/${business._id.toString()}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        businessId: business._id.toString(),
        provider: 'asaas',
        integrationStatus: 'configured',
        tenantFinancialStatus: 'active',
        usesGlobalFee: true,
        effectivePlatformFeePercent: 5,
        canEnableSplit: true,
        canEnableCheckout: true,
        warnings: [],
        splitPreview: {
          globalPercent: 5,
          tenantOverridePercent: null,
          effectivePlatformFeePercent: 5,
          platformPercent: 5,
          tenantNetPercent: 95,
          inheritsGlobal: true,
          splitActive: true,
          mode: 'global',
        },
        summary: {
          providerLabel: 'Asaas',
          integrationLabel: 'Configurado',
          tenantFinancialLabel: 'Ativo',
          splitLabel: 'Ativo',
          checkoutLabel: 'Ativo',
        },
        asaas: expect.objectContaining({
          enabled: true,
          connected: true,
          hasApiKey: true,
          walletId: 'wallet_sub_123',
          accountEmail: 'seller@example.com',
          accountName: 'Casa do Preto',
          status: 'active',
          subaccountId: 'subacc_123',
        }),
        split: expect.objectContaining({
          inheritsGlobal: true,
          effectivePlatformFeePercent: 5,
          platformWalletConfigured: true,
          defaultPlatformFeePercent: 5,
        }),
      }),
    );
    expect(response.body.data.asaas?.apiKeyEncrypted).toBeUndefined();
    expect(response.body.data.asaas?.apiKey).toBeUndefined();
  });

  it('updates tenant finance settings with encrypted api key and tenant split override', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });

    await SystemSetting.create({
      key: 'finance:asaas',
      value: {
        platformWalletId: 'wallet_platform_999',
        defaultPlatformFeePercent: 5,
      },
    });

    const response = await request(app)
      .patch(`/api/admin/finance/businesses/${business._id.toString()}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        enabled: true,
        provider: 'asaas',
        methods: {
          pix: true,
          creditCard: true,
          debitCard: true,
          cashOnPickup: true,
          cashOnDelivery: true,
        },
        asaas: {
          enabled: true,
          walletId: 'wallet_sub_override',
          accountEmail: 'financeiro@cliente.com',
          accountName: 'Acougue do Preto',
          status: 'active',
          apiKey: '$aact_hmlg_manual_connect',
        },
        split: {
          enabled: true,
          inheritsGlobal: false,
          platformFeePercent: 7.5,
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        enabled: true,
        provider: 'asaas',
        usesGlobalFee: false,
        effectivePlatformFeePercent: 7.5,
        canEnableSplit: true,
        canEnableCheckout: true,
        warnings: [],
        splitPreview: {
          globalPercent: 5,
          tenantOverridePercent: 7.5,
          effectivePlatformFeePercent: 7.5,
          platformPercent: 7.5,
          tenantNetPercent: 92.5,
          inheritsGlobal: false,
          splitActive: true,
          mode: 'custom',
        },
        asaas: expect.objectContaining({
          enabled: true,
          connected: true,
          hasApiKey: true,
          walletId: 'wallet_sub_override',
          accountEmail: 'financeiro@cliente.com',
          accountName: 'Acougue do Preto',
          status: 'active',
        }),
        split: expect.objectContaining({
          inheritsGlobal: false,
          effectivePlatformFeePercent: 7.5,
          platformWalletConfigured: true,
        }),
      }),
    );

    const storedBusiness = await Business.findById(business._id).lean();
    expect(storedBusiness.paymentSettings.asaas.apiKeyEncrypted).toMatch(/^v1:/);
    expect(decryptSecret(storedBusiness.paymentSettings.asaas.apiKeyEncrypted)).toBe('$aact_hmlg_manual_connect');
    expect(storedBusiness.paymentSettings.split.platformWalletId).toBe('wallet_platform_999');
    expect(storedBusiness.paymentSettings.split.platformFeePercent).toBe(7.5);
    expect(storedBusiness.paymentSettings.asaas.apiKey).toBeUndefined();
  });

  it('blocks split when the platform wallet is missing', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });

    const response = await request(app)
      .patch(`/api/admin/finance/businesses/${business._id.toString()}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        enabled: true,
        provider: 'asaas',
        asaas: {
          enabled: true,
          walletId: 'wallet_sub_override',
          status: 'active',
          apiKey: '$aact_hmlg_manual_connect',
        },
        split: {
          enabled: true,
          inheritsGlobal: true,
          platformFeePercent: 0,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('finance_platform_wallet_required');
  });

  it('blocks split when the tenant wallet is missing', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });

    await SystemSetting.create({
      key: 'finance:asaas',
      value: {
        platformWalletId: 'wallet_platform_999',
        defaultPlatformFeePercent: 5,
      },
    });

    const response = await request(app)
      .patch(`/api/admin/finance/businesses/${business._id.toString()}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        enabled: true,
        provider: 'asaas',
        asaas: {
          enabled: true,
          status: 'active',
          apiKey: '$aact_hmlg_manual_connect',
        },
        split: {
          enabled: true,
          inheritsGlobal: true,
          platformFeePercent: 0,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('finance_tenant_wallet_required');
  });

  it('blocks asaas activation when the global integration is invalid', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });
    envConfig.asaasApiKey = '';

    const response = await request(app)
      .patch(`/api/admin/finance/businesses/${business._id.toString()}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        enabled: true,
        provider: 'asaas',
        asaas: {
          enabled: true,
          walletId: 'wallet_sub_override',
          status: 'active',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('finance_integration_invalid');
  });

  it('blocks checkout when asaas is enabled without a valid active subaccount', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });

    await SystemSetting.create({
      key: 'finance:asaas',
      value: {
        platformWalletId: 'wallet_platform_999',
        defaultPlatformFeePercent: 5,
      },
    });

    const response = await request(app)
      .patch(`/api/admin/finance/businesses/${business._id.toString()}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        enabled: true,
        provider: 'asaas',
        asaas: {
          enabled: true,
          walletId: 'wallet_sub_override',
          status: 'pending',
        },
        methods: {
          pix: true,
          creditCard: true,
          debitCard: true,
          cashOnPickup: true,
          cashOnDelivery: true,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('finance_checkout_invalid');
  });

  it('creates an Asaas subaccount for the tenant and stores the returned api key encrypted', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });

    await SystemSetting.create({
      key: 'finance:asaas',
      value: {
        platformWalletId: 'wallet_platform_777',
        defaultPlatformFeePercent: 6,
      },
    });
    asaasServiceMock.createAsaasSubaccount.mockResolvedValue({
      id: 'subacc_created',
      walletId: 'wallet_sub_created',
      apiKey: '$aact_hmlg_created_only_once',
    });

    const response = await request(app)
      .post(`/api/admin/finance/businesses/${business._id.toString()}/asaas/subaccount`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Acougue do Preto',
        email: 'financeiro@cliente.com',
        cpfCnpj: '19131243000197',
        mobilePhone: '5511991112233',
        postalCode: '01310930',
        addressNumber: '100',
        province: 'Centro',
      });

    expect(response.status).toBe(201);
    expect(asaasServiceMock.createAsaasSubaccount).toHaveBeenCalledOnce();
    expect(response.body.data).toEqual(
      expect.objectContaining({
        provider: 'asaas',
        tenantFinancialStatus: 'active',
        canEnableCheckout: true,
        warnings: [],
        summary: expect.objectContaining({
          tenantFinancialLabel: 'Ativo',
          checkoutLabel: 'Ativo',
        }),
        asaas: expect.objectContaining({
          enabled: true,
          connected: true,
          hasApiKey: true,
          walletId: 'wallet_sub_created',
          accountEmail: 'financeiro@cliente.com',
          accountName: 'Acougue do Preto',
          status: 'active',
          subaccountId: 'subacc_created',
        }),
      }),
    );

    const storedBusiness = await Business.findById(business._id).lean();
    expect(decryptSecret(storedBusiness.paymentSettings.asaas.apiKeyEncrypted)).toBe('$aact_hmlg_created_only_once');
    expect(storedBusiness.paymentSettings.split.platformWalletId).toBe('wallet_platform_777');
  });

  it('validates required subaccount contact data before calling the Asaas API', async () => {
    const business = await Business.findOne({ slug: 'barbearia-estilo-vivo' });

    const response = await request(app)
      .post(`/api/admin/finance/businesses/${business._id.toString()}/asaas/subaccount`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        name: 'Acougue do Preto',
        email: 'financeiro@cliente.com',
        cpfCnpj: '19131243000197',
        mobilePhone: '',
        postalCode: '01310930',
        addressNumber: '100',
        province: 'Centro',
      });

    expect(response.status).toBe(400);
    expect(asaasServiceMock.createAsaasSubaccount).not.toHaveBeenCalled();
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'mobilePhone',
        }),
      ]),
    );
  });
});
