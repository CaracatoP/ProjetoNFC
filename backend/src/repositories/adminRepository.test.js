import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';

let connectDatabase;
let disconnectDatabase;
let Business;
let Subscription;
let listBusinessesForAdmin;
let mongoServer;

describe('adminRepository performance guards', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();

    ({ connectDatabase, disconnectDatabase } = await import('../config/database.js'));
    ({ Business } = await import('../models/Business.js'));
    ({ Subscription } = await import('../models/Subscription.js'));
    ({ listBusinessesForAdmin } = await import('./adminRepository.js'));

    await connectDatabase();
  });

  beforeEach(async () => {
    await Business.deleteMany({});
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongoServer.stop();
  });

  it('keeps the admin business list projection lean and free of heavy editor fields', async () => {
    await Business.create({
      name: 'Tenant de Teste',
      slug: 'tenant-de-teste',
      status: 'active',
      description: 'Descricao curta',
      modules: {
        catalog: true,
        appointments: false,
        cart: false,
        orders: false,
        loyalty: false,
        whatsapp: true,
        analytics: false,
      },
      contact: {
        whatsapp: '5511999999999',
        wifi: {
          ssid: 'Rede',
          password: 'Senha123',
          security: 'WPA',
        },
      },
      seo: {
        title: 'Tenant de Teste',
        description: 'Tenant de Teste',
      },
      history: [
        {
          field: 'business.name',
          oldValue: 'A',
          newValue: 'B',
        },
      ],
    });

    const [result] = await listBusinessesForAdmin();

    expect(result.name).toBe('Tenant de Teste');
    expect(result.slug).toBe('tenant-de-teste');
    expect(result.modules.catalog).toBe(true);
    expect(result.history).toBeUndefined();
    expect(result.contact).toBeUndefined();
    expect(result.seo).toBeUndefined();
  });

  it('keeps an explicit index for subscription status filtering', () => {
    const indexes = Subscription.schema.indexes();

    expect(indexes.some(([fields]) => fields.status === 1)).toBe(true);
  });
});
