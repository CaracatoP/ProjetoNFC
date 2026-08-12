import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const asaasServiceMock = vi.hoisted(() => ({
  createAsaasCustomer: vi.fn(),
  listAsaasCustomers: vi.fn(),
}));

vi.mock('./asaasService.js', async () => {
  const actual = await vi.importActual('./asaasService.js');

  return {
    ...actual,
    createAsaasCustomer: asaasServiceMock.createAsaasCustomer,
    listAsaasCustomers: asaasServiceMock.listAsaasCustomers,
  };
});

let mongoServer;
let PaymentCustomer;
let resolveOrCreateAsaasPaymentCustomer;

describe('paymentCustomerService', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    ({ PaymentCustomer } = await import('../models/PaymentCustomer.js'));
    ({ resolveOrCreateAsaasPaymentCustomer } = await import('./paymentCustomerService.js'));
    await PaymentCustomer.init();
  }, 30000);

  beforeEach(async () => {
    await PaymentCustomer.deleteMany({});
    asaasServiceMock.createAsaasCustomer.mockReset();
    asaasServiceMock.listAsaasCustomers.mockReset();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('reconciles a previously created remote Asaas customer by externalReference instead of creating a duplicate', async () => {
    const businessId = new mongoose.Types.ObjectId();
    const existingReference = await PaymentCustomer.create({
      businessId,
      provider: 'asaas',
      identityKind: 'phone',
      identityValue: '5511999999999',
      identityKey: 'phone:5511999999999',
      externalReference: `tenant:${businessId}:customer:reconcile-local-id`,
      status: 'failed',
      name: 'Cliente Reconciliado',
      phone: '5511999999999',
      lastErrorMessage: 'Falha local depois da criacao remota.',
    });

    asaasServiceMock.listAsaasCustomers.mockResolvedValue({
      data: [
        {
          id: 'cus_reconciled_123',
          externalReference: existingReference.externalReference,
        },
      ],
    });

    const result = await resolveOrCreateAsaasPaymentCustomer({
      businessId,
      apiKey: 'encrypted-sub-key',
      name: 'Cliente Reconciliado',
      phone: '55 (11) 99999-9999',
    });

    const updatedReference = await PaymentCustomer.findById(existingReference._id).lean();

    expect(result).toEqual({
      id: 'cus_reconciled_123',
      source: 'asaas_external_reference_reconciliation',
    });
    expect(asaasServiceMock.listAsaasCustomers).toHaveBeenCalledWith({
      apiKey: 'encrypted-sub-key',
      filters: {
        externalReference: existingReference.externalReference,
        limit: 1,
      },
    });
    expect(asaasServiceMock.createAsaasCustomer).not.toHaveBeenCalled();
    expect(updatedReference).toEqual(
      expect.objectContaining({
        providerCustomerId: 'cus_reconciled_123',
        status: 'ready',
        lastErrorMessage: '',
      }),
    );
  });
});
