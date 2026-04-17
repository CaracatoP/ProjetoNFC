import mongoose from 'mongoose';
import { SECTION_TYPE_VALUES } from '../../../shared/constants/index.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const businessSectionSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    key: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: SECTION_TYPE_VALUES, index: true },
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    order: { type: Number, default: 0 },
    visible: { type: Boolean, default: true },
    variant: { type: String, trim: true },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  baseSchemaOptions,
);

businessSectionSchema.index({ businessId: 1, key: 1 }, { unique: true });

export const BusinessSection =
  mongoose.models.BusinessSection || mongoose.model('BusinessSection', businessSectionSchema);

