import mongoose from 'mongoose';
import { baseSchemaOptions } from '../utils/mongoose.js';

const professionalSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, trim: true },
    avatar: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
  },
  baseSchemaOptions,
);

professionalSchema.index({ businessId: 1, active: 1, createdAt: 1 });

export const Professional =
  mongoose.models.Professional || mongoose.model('Professional', professionalSchema);
