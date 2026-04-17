import mongoose from 'mongoose';
import { ANALYTICS_EVENT_TYPE_VALUES, SECTION_TYPE_VALUES } from '../../../shared/constants/index.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const analyticsEventSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    eventType: { type: String, required: true, enum: ANALYTICS_EVENT_TYPE_VALUES, index: true },
    sectionType: { type: String, enum: SECTION_TYPE_VALUES },
    targetType: { type: String, trim: true },
    targetId: { type: String, trim: true },
    targetLabel: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, default: Date.now },
    visitorHash: { type: String, trim: true, index: true },
    userAgent: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
  },
  baseSchemaOptions,
);

export const AnalyticsEvent =
  mongoose.models.AnalyticsEvent || mongoose.model('AnalyticsEvent', analyticsEventSchema);

