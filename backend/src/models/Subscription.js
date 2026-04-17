import mongoose from 'mongoose';
import { SUBSCRIPTION_STATUS_VALUES } from '../../../shared/constants/index.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const subscriptionSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    status: { type: String, enum: SUBSCRIPTION_STATUS_VALUES, required: true },
    provider: { type: String, trim: true },
    providerSubscriptionId: { type: String, trim: true },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAt: Date,
  },
  baseSchemaOptions,
);

export const Subscription =
  mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
