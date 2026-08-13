import mongoose from 'mongoose';
import {
  TENANT_LEDGER_ENTRY_STATUSES,
  TENANT_LEDGER_ENTRY_STATUS_VALUES,
  TENANT_LEDGER_ENTRY_TYPES,
  TENANT_LEDGER_ENTRY_TYPE_VALUES,
} from '../../../shared/constants/index.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const tenantLedgerEntrySchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    type: {
      type: String,
      enum: TENANT_LEDGER_ENTRY_TYPE_VALUES,
      default: TENANT_LEDGER_ENTRY_TYPES.ADJUSTMENT,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: TENANT_LEDGER_ENTRY_STATUS_VALUES,
      default: TENANT_LEDGER_ENTRY_STATUSES.AVAILABLE,
      required: true,
      trim: true,
      index: true,
    },
    amount: { type: Number, required: true, default: 0 },
    description: { type: String, trim: true, default: '' },
    idempotencyKey: { type: String, required: true, unique: true, index: true, trim: true },
    availableAt: { type: Date, default: null, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  baseSchemaOptions,
);

tenantLedgerEntrySchema.index({ businessId: 1, createdAt: -1 });
tenantLedgerEntrySchema.index({ businessId: 1, status: 1, type: 1, createdAt: -1 });
tenantLedgerEntrySchema.index({ businessId: 1, paymentId: 1, type: 1 });

export const TenantLedgerEntry =
  mongoose.models.TenantLedgerEntry || mongoose.model('TenantLedgerEntry', tenantLedgerEntrySchema);
