import mongoose from 'mongoose';
import { baseSchemaOptions } from '../utils/mongoose.js';

const businessThemeSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, unique: true, index: true },
    version: { type: Number, default: 2 },
    backgroundColor: { type: String, trim: true },
    cardColor: { type: String, trim: true },
    buttonHoverColor: { type: String, trim: true },
    primaryButtonColor: { type: String, trim: true },
    textColor: { type: String, trim: true },
    accentColor: { type: String, trim: true },
    borderColor: { type: String, trim: true },
    secondaryColor: { type: String, trim: true },
    typography: { type: mongoose.Schema.Types.Mixed },
    spacing: { type: mongoose.Schema.Types.Mixed },
    radius: { type: mongoose.Schema.Types.Mixed },
    layout: { type: mongoose.Schema.Types.Mixed },
    // Legacy fields remain optional so old theme documents can still be read safely.
    colors: { type: mongoose.Schema.Types.Mixed },
    buttons: { type: mongoose.Schema.Types.Mixed },
    areas: { type: mongoose.Schema.Types.Mixed },
    customCss: { type: String, trim: true },
  },
  baseSchemaOptions,
);

export const BusinessTheme =
  mongoose.models.BusinessTheme || mongoose.model('BusinessTheme', businessThemeSchema);
