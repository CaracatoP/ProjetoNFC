import { PAYMENT_PROVIDERS } from '../../../shared/constants/index.js';
import {
  createAsaasCustomer,
  listAsaasCustomers,
} from './asaasService.js';
import {
  acquireStalePaymentCustomerCreation,
  ensurePaymentCustomerExternalReference,
  findPaymentCustomerById,
  markPaymentCustomerFailed,
  markPaymentCustomerReady,
  reservePaymentCustomerReference,
} from '../repositories/paymentCustomerRepository.js';
import { AppError } from '../utils/appError.js';

const CUSTOMER_READY_WAIT_ATTEMPTS = 20;
const CUSTOMER_READY_WAIT_MS = 250;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPaymentCustomerReady(recordId) {
  for (let attempt = 0; attempt < CUSTOMER_READY_WAIT_ATTEMPTS; attempt += 1) {
    const current = await findPaymentCustomerById(recordId);

    if (!current) {
      return null;
    }

    if (current.status === 'ready' && current.providerCustomerId) {
      return current;
    }

    if (current.status === 'failed') {
      return current;
    }

    await delay(CUSTOMER_READY_WAIT_MS);
  }

  return findPaymentCustomerById(recordId);
}

function firstAsaasCustomerFromList(response = {}) {
  const customers = Array.isArray(response?.data) ? response.data : [];

  return customers.find((customer) => String(customer?.id || '').trim()) || null;
}

async function reconcileAsaasCustomerByExternalReference({
  apiKey,
  externalReference,
  businessId,
  record,
  customerPayload,
  metadata = {},
}) {
  if (!externalReference) {
    return null;
  }

  const response = await listAsaasCustomers({
    apiKey,
    filters: {
      externalReference,
      limit: 1,
    },
  });
  const remoteCustomer = firstAsaasCustomerFromList(response);
  const providerCustomerId = String(remoteCustomer?.id || '').trim();

  if (!providerCustomerId) {
    return null;
  }

  const updated = await markPaymentCustomerReady({
    id: record._id,
    businessId,
    provider: PAYMENT_PROVIDERS.ASAAS,
    providerCustomerId,
    name: customerPayload.name,
    phone: customerPayload.mobilePhone,
    email: customerPayload.email,
    document: customerPayload.cpfCnpj,
    externalReference,
    metadata: {
      ...metadata,
      source: 'asaas_external_reference_reconciliation',
    },
  });

  return updated || { providerCustomerId };
}

async function createAndStoreAsaasCustomer({
  apiKey,
  businessId,
  record,
  externalReference,
  customerPayload,
  metadata = {},
}) {
  try {
    const remoteCustomer = await createAsaasCustomer({
      apiKey,
      customer: {
        ...customerPayload,
        externalReference,
      },
    });
    const providerCustomerId = String(remoteCustomer?.id || '').trim();

    if (!providerCustomerId) {
      throw new AppError('Asaas nao retornou o customer criado.', 502, 'asaas_customer_missing_id');
    }

    return markPaymentCustomerReady({
      id: record._id,
      businessId,
      provider: PAYMENT_PROVIDERS.ASAAS,
      providerCustomerId,
      name: customerPayload.name,
      phone: customerPayload.mobilePhone,
      email: customerPayload.email,
      document: customerPayload.cpfCnpj,
      externalReference,
      metadata: {
        ...metadata,
        source: 'asaas_create_customer',
      },
    });
  } catch (error) {
    const reconciled = await reconcileAsaasCustomerByExternalReference({
      apiKey,
      externalReference,
      businessId,
      record,
      customerPayload,
      metadata,
    }).catch(() => null);

    if (reconciled?.providerCustomerId) {
      return reconciled;
    }

    await markPaymentCustomerFailed(record._id, error).catch(() => {});
    throw error;
  }
}

function buildAsaasCustomerPayload({
  name = '',
  phone = '',
  email = '',
  document = '',
} = {}) {
  const normalizedName = String(name || '').trim();
  const normalizedPhone = String(phone || '').replace(/\D/g, '');
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedDocument = String(document || '').replace(/\D/g, '');

  return {
    name: normalizedName || 'Cliente TapLink',
    mobilePhone: normalizedPhone,
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    ...(normalizedDocument ? { cpfCnpj: normalizedDocument } : {}),
  };
}

export async function resolveOrCreateAsaasPaymentCustomer({
  businessId,
  apiKey,
  name = '',
  phone = '',
  email = '',
  document = '',
} = {}) {
  const customerPayload = buildAsaasCustomerPayload({ name, phone, email, document });
  const reservation = await reservePaymentCustomerReference({
    businessId,
    provider: PAYMENT_PROVIDERS.ASAAS,
    name: customerPayload.name,
    phone: customerPayload.mobilePhone,
    email: customerPayload.email,
    document: customerPayload.cpfCnpj,
    metadata: {
      source: 'public_order_checkout',
    },
  });

  if (!reservation.record) {
    const remoteCustomer = await createAsaasCustomer({
      apiKey,
      customer: customerPayload,
    });

    return {
      id: String(remoteCustomer?.id || '').trim(),
      source: 'asaas_create_customer_without_local_identity',
    };
  }

  if (reservation.record.status === 'ready' && reservation.record.providerCustomerId) {
    return {
      id: String(reservation.record.providerCustomerId || '').trim(),
      source: 'local_reference',
    };
  }

  const externalReference = await ensurePaymentCustomerExternalReference(reservation.record);

  if (!reservation.created) {
    const waitedRecord = await waitForPaymentCustomerReady(reservation.record._id);

    if (waitedRecord?.status === 'ready' && waitedRecord.providerCustomerId) {
      return {
        id: String(waitedRecord.providerCustomerId || '').trim(),
        source: 'local_reference_after_wait',
      };
    }

    const reconciled = await reconcileAsaasCustomerByExternalReference({
      apiKey,
      externalReference,
      businessId,
      record: waitedRecord || reservation.record,
      customerPayload,
      metadata: {
        source: 'public_order_checkout',
      },
    });

    if (reconciled?.providerCustomerId) {
      return {
        id: String(reconciled.providerCustomerId || '').trim(),
        source: 'asaas_external_reference_reconciliation',
      };
    }

    const acquiredRecord = await acquireStalePaymentCustomerCreation(waitedRecord || reservation.record);

    if (!acquiredRecord) {
      throw new AppError(
        'Cadastro do cliente ainda esta em processamento. Tente novamente em instantes.',
        409,
        'payment_customer_creation_in_progress',
      );
    }

    const created = await createAndStoreAsaasCustomer({
      apiKey,
      businessId,
      record: acquiredRecord,
      externalReference,
      customerPayload,
      metadata: {
        source: 'public_order_checkout',
      },
    });

    return {
      id: String(created?.providerCustomerId || '').trim(),
      source: 'asaas_create_customer_after_stale_lock',
    };
  }

  const created = await createAndStoreAsaasCustomer({
    apiKey,
    businessId,
    record: reservation.record,
    externalReference,
    customerPayload,
    metadata: {
      source: 'public_order_checkout',
    },
  });

  return {
    id: String(created?.providerCustomerId || '').trim(),
    source: 'asaas_create_customer',
  };
}
