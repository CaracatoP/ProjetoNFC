import mongoose from 'mongoose';
import { PLAN_TYPE_VALUES } from '../../../shared/constants/index.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const planSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: PLAN_TYPE_VALUES, required: true },
    priceCents: { type: Number, default: 0 },
    currency: { type: String, default: 'BRL', trim: true },
    active: { type: Boolean, default: true },
    features: { type: [String], default: [] },
  },
  baseSchemaOptions,
);

export const Plan = mongoose.models.Plan || mongoose.model('Plan', planSchema);

