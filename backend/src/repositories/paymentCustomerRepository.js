import { PaymentCustomer } from '../models/PaymentCustomer.js';
import { normalizeCustomerDocument } from '../../../shared/utils/customerDocument.js';

const CUSTOMER_CREATION_STALE_MS = 2 * 60 * 1000;

export function normalizePaymentCustomerPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizePaymentCustomerEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizePaymentCustomerDocument(value) {
  return normalizeCustomerDocument(value);
}

export function resolvePaymentCustomerIdentity({
  document = '',
  phone = '',
  email = '',
} = {}) {
  const normalizedDocument = normalizePaymentCustomerDocument(document);
  const normalizedPhone = normalizePaymentCustomerPhone(phone);
  const normalizedEmail = normalizePaymentCustomerEmail(email);

  if (normalizedDocument) {
    return {
      kind: 'document',
      value: normalizedDocument,
      key: `document:${normalizedDocument}`,
    };
  }

  if (normalizedPhone) {
    return {
      kind: 'phone',
      value: normalizedPhone,
      key: `phone:${normalizedPhone}`,
    };
  }

  if (normalizedEmail) {
    return {
      kind: 'email',
      value: normalizedEmail,
      key: `email:${normalizedEmail}`,
    };
  }

  return {
    kind: '',
    value: '',
    key: '',
  };
}

export function buildPaymentCustomerExternalReference(businessId, paymentCustomerId) {
  const normalizedBusinessId = String(businessId || '').trim();
  const normalizedPaymentCustomerId = String(paymentCustomerId || '').trim();

  if (!normalizedBusinessId || !normalizedPaymentCustomerId) {
    return '';
  }

  return `tenant:${normalizedBusinessId}:customer:${normalizedPaymentCustomerId}`;
}

export function isPaymentCustomerCreationStale(record, now = new Date()) {
  if (!record || record.status !== 'creating') {
    return false;
  }

  const updatedAt = record.updatedAt || record.createdAt;
  const updatedAtMs = updatedAt ? new Date(updatedAt).getTime() : 0;

  return !updatedAtMs || now.getTime() - updatedAtMs > CUSTOMER_CREATION_STALE_MS;
}

export async function findReusablePaymentCustomer({
  businessId,
  provider,
  phone = '',
  email = '',
  document = '',
}) {
  const identity = resolvePaymentCustomerIdentity({ document, phone, email });

  if (!identity.key) {
    return null;
  }

  return PaymentCustomer.findOne({
    businessId,
    provider,
    identityKey: identity.key,
  });
}

export async function reservePaymentCustomerReference({
  businessId,
  provider,
  name = '',
  phone = '',
  email = '',
  document = '',
  metadata = {},
}) {
  const identity = resolvePaymentCustomerIdentity({ document, phone, email });

  if (!identity.key) {
    return {
      created: false,
      record: null,
      identity,
    };
  }

  const normalizedPayload = {
    businessId,
    provider,
    identityKind: identity.kind,
    identityValue: identity.value,
    identityKey: identity.key,
    name: String(name || '').trim(),
    phone: normalizePaymentCustomerPhone(phone),
    email: normalizePaymentCustomerEmail(email),
    document: normalizePaymentCustomerDocument(document),
    status: 'creating',
    metadata,
  };

  try {
    const result = await PaymentCustomer.findOneAndUpdate(
      {
        businessId,
        provider,
        identityKey: identity.key,
      },
      {
        $setOnInsert: normalizedPayload,
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
        setDefaultsOnInsert: true,
        includeResultMetadata: true,
      },
    );
    const record = result?.value || result;

    return {
      created: !result?.lastErrorObject?.updatedExisting,
      record,
      identity,
    };
  } catch (error) {
    if (error?.code === 11000) {
      return {
        created: false,
        record: await findReusablePaymentCustomer({ businessId, provider, phone, email, document }),
        identity,
      };
    }

    throw error;
  }
}

export async function ensurePaymentCustomerExternalReference(record) {
  if (!record) {
    return '';
  }

  const externalReference =
    record.externalReference ||
    buildPaymentCustomerExternalReference(record.businessId, record._id);

  if (!externalReference || record.externalReference === externalReference) {
    return externalReference;
  }

  await PaymentCustomer.updateOne(
    { _id: record._id },
    { $set: { externalReference } },
  );

  return externalReference;
}

export async function markPaymentCustomerReady({
  id,
  businessId,
  provider,
  providerCustomerId,
  name = '',
  phone = '',
  email = '',
  document = '',
  externalReference = '',
  metadata = {},
}) {
  const normalizedProviderCustomerId = String(providerCustomerId || '').trim();

  if (!normalizedProviderCustomerId) {
    return null;
  }

  return PaymentCustomer.findOneAndUpdate(
    {
      _id: id,
      businessId,
      provider,
    },
    {
      $set: {
        providerCustomerId: normalizedProviderCustomerId,
        name: String(name || '').trim(),
        phone: normalizePaymentCustomerPhone(phone),
        email: normalizePaymentCustomerEmail(email),
        document: normalizePaymentCustomerDocument(document),
        externalReference: String(externalReference || '').trim(),
        status: 'ready',
        metadata,
        lastSyncedAt: new Date(),
        lastErrorMessage: '',
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );
}

export async function markPaymentCustomerFailed(id, error) {
  return PaymentCustomer.findByIdAndUpdate(
    id,
    {
      status: 'failed',
      lastErrorMessage: String(error?.message || 'Falha ao criar customer Asaas.')
        .trim()
        .slice(0, 500),
    },
    { new: true },
  );
}

export async function acquireStalePaymentCustomerCreation(record) {
  if (!isPaymentCustomerCreationStale(record) && record?.status !== 'failed') {
    return null;
  }

  return PaymentCustomer.findOneAndUpdate(
    {
      _id: record._id,
      status: record.status === 'failed' ? 'failed' : 'creating',
      ...(record.status === 'creating'
        ? { updatedAt: { $lte: new Date(Date.now() - CUSTOMER_CREATION_STALE_MS) } }
        : {}),
    },
    {
      $set: {
        status: 'creating',
        lastErrorMessage: '',
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );
}

export async function findPaymentCustomerById(id) {
  return PaymentCustomer.findById(id);
}

export async function upsertPaymentCustomerReference(payload) {
  const reservation = await reservePaymentCustomerReference(payload);

  if (!reservation.record) {
    return null;
  }

  return markPaymentCustomerReady({
    ...payload,
    id: reservation.record._id,
    externalReference:
      payload.externalReference ||
      buildPaymentCustomerExternalReference(payload.businessId, reservation.record._id),
  });
}
