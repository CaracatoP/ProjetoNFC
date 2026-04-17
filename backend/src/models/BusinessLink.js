import mongoose from 'mongoose';
import { LINK_GROUPS, LINK_TYPE_VALUES } from '../../../shared/constants/index.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const businessLinkSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    type: { type: String, required: true, enum: LINK_TYPE_VALUES, index: true },
    group: { type: String, default: LINK_GROUPS.PRIMARY, trim: true },
    label: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    icon: { type: String, trim: true },
    url: { type: String, trim: true },
    value: { type: String, trim: true },
    visible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    target: { type: String, default: '_blank', trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  baseSchemaOptions,
);

export const BusinessLink =
  mongoose.models.BusinessLink || mongoose.model('BusinessLink', businessLinkSchema);

