import mongoose from 'mongoose';
import { TENANT_PAYOUT_STATUSES, TENANT_PAYOUT_STATUS_VALUES } from '../../../shared/constants/index.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const tenantPayoutSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    amount: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: TENANT_PAYOUT_STATUS_VALUES,
      default: TENANT_PAYOUT_STATUSES.PENDING,
      required: true,
      trim: true,
      index: true,
    },
    requestedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    reference: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  baseSchemaOptions,
);

tenantPayoutSchema.index({ businessId: 1, status: 1, createdAt: -1 });

export const TenantPayout =
  mongoose.models.TenantPayout || mongoose.model('TenantPayout', tenantPayoutSchema);
