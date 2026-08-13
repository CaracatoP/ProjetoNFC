import mongoose from 'mongoose';
import { baseSchemaOptions } from '../utils/mongoose.js';

const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, trim: true, index: true },
    eventId: { type: String, required: true, trim: true },
    eventType: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['processing', 'processed', 'failed', 'ignored'],
      default: 'processing',
      index: true,
    },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
    resourceType: { type: String, trim: true, default: '' },
    resourceId: { type: String, trim: true, default: '' },
    providerResourceId: { type: String, trim: true, default: '' },
    processedAt: { type: Date, default: null },
    errorCode: { type: String, trim: true, default: '' },
    errorMessage: { type: String, trim: true, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  baseSchemaOptions,
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
webhookEventSchema.index({ provider: 1, eventType: 1, createdAt: -1 });

export const WebhookEvent =
  mongoose.models.WebhookEvent || mongoose.model('WebhookEvent', webhookEventSchema);
