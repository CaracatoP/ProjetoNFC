import mongoose from 'mongoose';
import { baseSchemaOptions } from '../utils/mongoose.js';

const businessThemeSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, unique: true, index: true },
    colors: { type: mongoose.Schema.Types.Mixed, required: true },
    typography: { type: mongoose.Schema.Types.Mixed, required: true },
    spacing: { type: mongoose.Schema.Types.Mixed, required: true },
    radius: { type: mongoose.Schema.Types.Mixed, required: true },
    layout: { type: mongoose.Schema.Types.Mixed, required: true },
    buttons: { type: mongoose.Schema.Types.Mixed, required: true },
    customCss: { type: String, trim: true },
  },
  baseSchemaOptions,
);

export const BusinessTheme =
  mongoose.models.BusinessTheme || mongoose.model('BusinessTheme', businessThemeSchema);

