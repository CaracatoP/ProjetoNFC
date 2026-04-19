import mongoose from 'mongoose';
import { BUSINESS_STATUS_VALUES } from '../../../shared/constants/index.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true },
    slug: { type: String, required: true, unique: true, index: true, trim: true },
    description: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    logoPublicId: { type: String, trim: true },
    bannerUrl: { type: String, trim: true },
    bannerPublicId: { type: String, trim: true },
    badge: { type: String, trim: true },
    status: { type: String, enum: BUSINESS_STATUS_VALUES, default: 'draft', index: true },
    rating: { type: String, trim: true },
    domains: {
      subdomain: { type: String, trim: true, lowercase: true },
      customDomain: { type: String, trim: true, lowercase: true },
      customDomainVerifiedAt: Date,
    },
    address: {
      display: { type: String, trim: true },
      mapUrl: { type: String, trim: true },
      embedUrl: { type: String, trim: true },
      latitude: Number,
      longitude: Number,
    },
    hours: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        value: { type: String, required: true },
        _id: false,
      },
    ],
    contact: {
      whatsapp: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      wifi: {
        ssid: { type: String, trim: true },
        password: { type: String, trim: true },
        security: { type: String, default: 'WPA', trim: true },
        title: { type: String, trim: true },
        description: { type: String, trim: true },
      },
      pix: {
        keyType: { type: String, trim: true },
        key: { type: String, trim: true },
        receiverName: { type: String, trim: true },
        city: { type: String, trim: true },
        description: { type: String, trim: true },
        actionLabel: { type: String, trim: true },
        actionDescription: { type: String, trim: true },
      },
    },
    seo: {
      title: { type: String, required: true, trim: true },
      description: { type: String, required: true, trim: true },
      imageUrl: { type: String, trim: true },
      imagePublicId: { type: String, trim: true },
    },
  },
  baseSchemaOptions,
);

businessSchema.index(
  { 'domains.subdomain': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'domains.subdomain': { $exists: true, $type: 'string' },
    },
  },
);

businessSchema.index(
  { 'domains.customDomain': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'domains.customDomain': { $exists: true, $type: 'string' },
    },
  },
);

export const Business = mongoose.models.Business || mongoose.model('Business', businessSchema);
