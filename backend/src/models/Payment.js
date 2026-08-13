import mongoose from 'mongoose';
import {
  DEFAULT_PAYMENT_ARCHITECTURE,
  DEFAULT_PAYMENT_METHOD,
  DEFAULT_PAYMENT_PROVIDER,
  DEFAULT_PAYMENT_STATUS,
  PAYMENT_ARCHITECTURE_VALUES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_PROVIDER_VALUES,
  PAYMENT_STATUS_VALUES,
} from '../../../shared/constants/index.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const paymentSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDER_VALUES,
      default: DEFAULT_PAYMENT_PROVIDER,
      required: true,
      trim: true,
      index: true,
    },
    method: {
      type: String,
      enum: PAYMENT_METHOD_VALUES,
      default: DEFAULT_PAYMENT_METHOD,
      required: true,
      trim: true,
    },
    paymentArchitecture: {
      type: String,
      enum: PAYMENT_ARCHITECTURE_VALUES,
      default: DEFAULT_PAYMENT_ARCHITECTURE,
      required: true,
      trim: true,
      index: true,
    },
    billingType: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: DEFAULT_PAYMENT_STATUS,
      required: true,
      trim: true,
      index: true,
    },
    providerStatus: { type: String, trim: true, default: '' },
    providerPaymentId: { type: String, trim: true, default: '', index: true },
    providerCustomerId: { type: String, trim: true, default: '' },
    externalReference: { type: String, trim: true, default: '', index: true },
    amount: { type: Number, required: true, min: 0, default: 0 },
    grossAmount: { type: Number, required: true, min: 0, default: 0 },
    platformFeeAmount: { type: Number, min: 0, default: 0 },
    tenantNetAmount: { type: Number, min: 0, default: 0 },
    refundedAmount: { type: Number, min: 0, default: 0 },
    invoiceUrl: { type: String, trim: true, default: '' },
    bankSlipUrl: { type: String, trim: true, default: '' },
    checkoutUrl: { type: String, trim: true, default: '' },
    pixCopyPaste: { type: String, trim: true, default: '' },
    pixQrCode: { type: String, trim: true, default: '' },
    pixQrCodeUrl: { type: String, trim: true, default: '' },
    paidAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    providerUpdatedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  baseSchemaOptions,
);

paymentSchema.index({ businessId: 1, orderId: 1, provider: 1 });
paymentSchema.index(
  { provider: 1, providerPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerPaymentId: { $exists: true, $type: 'string', $gt: '' },
    },
  },
);
paymentSchema.index(
  { provider: 1, externalReference: 1 },
  {
    unique: true,
    partialFilterExpression: {
      externalReference: { $exists: true, $type: 'string', $gt: '' },
    },
  },
);

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
