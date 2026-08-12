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
    providerCustomerId: { type: String, trim: true, default: '', index: true },
    identityKind: {
      type: String,
      enum: ['', 'document', 'phone', 'email'],
      default: '',
      trim: true,
      index: true,
    },
    identityValue: { type: String, trim: true, default: '' },
    identityKey: { type: String, trim: true, default: '' },
    externalReference: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['creating', 'ready', 'failed'],
      default: 'ready',
      trim: true,
      index: true,
    },
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    document: { type: String, trim: true, default: '' },
    lastSyncedAt: { type: Date, default: null },
    lastErrorMessage: { type: String, trim: true, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  baseSchemaOptions,
);

paymentCustomerSchema.index(
  { businessId: 1, provider: 1, identityKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      identityKey: { $exists: true, $type: 'string', $gt: '' },
    },
  },
);
paymentCustomerSchema.index(
  { provider: 1, providerCustomerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerCustomerId: { $exists: true, $type: 'string', $gt: '' },
    },
  },
);
paymentCustomerSchema.index(
  { provider: 1, externalReference: 1 },
  {
    unique: true,
    partialFilterExpression: {
      externalReference: { $exists: true, $type: 'string', $gt: '' },
    },
  },
);
paymentCustomerSchema.index({ businessId: 1, provider: 1, phone: 1 });
paymentCustomerSchema.index({ businessId: 1, provider: 1, email: 1 });

export const PaymentCustomer =
  mongoose.models.PaymentCustomer || mongoose.model('PaymentCustomer', paymentCustomerSchema);
