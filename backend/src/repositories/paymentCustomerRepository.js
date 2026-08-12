import { PaymentCustomer } from '../models/PaymentCustomer.js';

export function normalizePaymentCustomerPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizePaymentCustomerEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export async function findReusablePaymentCustomer({
  businessId,
  provider,
  phone = '',
  email = '',
}) {
  const normalizedPhone = normalizePaymentCustomerPhone(phone);
  const normalizedEmail = normalizePaymentCustomerEmail(email);
  const orFilters = [];

  if (normalizedPhone) {
    orFilters.push({ phone: normalizedPhone });
  }

  if (normalizedEmail) {
    orFilters.push({ email: normalizedEmail });
  }

  if (!orFilters.length) {
    return null;
  }

  return PaymentCustomer.findOne({
    businessId,
    provider,
    $or: orFilters,
  });
}

export async function upsertPaymentCustomerReference({
  businessId,
  provider,
  providerCustomerId,
  name = '',
  phone = '',
  email = '',
  document = '',
  metadata = {},
}) {
  const normalizedProviderCustomerId = String(providerCustomerId || '').trim();

  if (!normalizedProviderCustomerId) {
    return null;
  }

  try {
    return await PaymentCustomer.findOneAndUpdate(
      {
        provider,
        providerCustomerId: normalizedProviderCustomerId,
      },
      {
        $set: {
          businessId,
          name: String(name || '').trim(),
          phone: normalizePaymentCustomerPhone(phone),
          email: normalizePaymentCustomerEmail(email),
          document: normalizePaymentCustomerPhone(document),
          metadata,
          lastSyncedAt: new Date(),
        },
        $setOnInsert: {
          provider,
          providerCustomerId: normalizedProviderCustomerId,
        },
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
      },
    );
  } catch (error) {
    if (error?.code === 11000) {
      return findReusablePaymentCustomer({ businessId, provider, phone, email });
    }

    throw error;
  }
}
