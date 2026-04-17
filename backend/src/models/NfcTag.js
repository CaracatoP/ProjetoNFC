import mongoose from 'mongoose';
import { baseSchemaOptions } from '../utils/mongoose.js';

const nfcTagSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    code: { type: String, required: true, unique: true, index: true, trim: true },
    status: { type: String, default: 'active', trim: true },
    lastResolvedAt: Date,
  },
  baseSchemaOptions,
);

export const NfcTag = mongoose.models.NfcTag || mongoose.model('NfcTag', nfcTagSchema);

