import mongoose from 'mongoose';
import { baseSchemaOptions } from '../utils/mongoose.js';

const systemSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  baseSchemaOptions,
);

export const SystemSetting =
  mongoose.models.SystemSetting || mongoose.model('SystemSetting', systemSettingSchema);
