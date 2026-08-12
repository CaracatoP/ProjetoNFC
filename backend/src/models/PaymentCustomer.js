import mongoose from 'mongoose';
import {
  PAYMENT_PROVIDER_VALUES,
  PAYMENT_PROVIDERS,
} from '../../../shared/constants/index.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const paymentCustomerSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDER_VALUES,
      default: PAYMENT_PROVIDERS.MANUAL,
      required: true,
      trim: true,
      index: true,
    },
    providerCustomerId: { type: String, required: true, trim: true, index: true },
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    document: { type: String, trim: true, default: '' },
    lastSyncedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  baseSchemaOptions,
);

paymentCustomerSchema.index(
  { businessId: 1, provider: 1, phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phone: { $exists: true, $type: 'string', $ne: '' },
    },
  },
);
paymentCustomerSchema.index(
  { businessId: 1, provider: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $exists: true, $type: 'string', $ne: '' },
    },
  },
);
paymentCustomerSchema.index(
  { provider: 1, providerCustomerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerCustomerId: { $exists: true, $type: 'string', $ne: '' },
    },
  },
);

export const PaymentCustomer =
  mongoose.models.PaymentCustomer || mongoose.model('PaymentCustomer', paymentCustomerSchema);
