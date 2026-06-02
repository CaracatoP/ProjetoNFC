import mongoose from 'mongoose';
import {
  BUSINESS_SEGMENT_VALUES,
  BUSINESS_STATUS_VALUES,
  PAYMENT_PROVIDER_VALUES,
} from '../../../shared/constants/index.js';
import { normalizeBusinessContact } from '../../../shared/utils/businessContact.js';
import { normalizeBusinessPaymentSettings } from '../../../shared/utils/businessPayment.js';
import { buildBusinessSegmentState } from '../../../shared/utils/segments.js';
import { baseSchemaOptions } from '../utils/mongoose.js';

const defaultSegmentState = buildBusinessSegmentState();
const baseToJSONTransform = baseSchemaOptions.toJSON?.transform;
const baseToObjectTransform = baseSchemaOptions.toObject?.transform;

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
    analyticsBaselineAt: { type: Date },
    segment: { type: String, enum: BUSINESS_SEGMENT_VALUES, default: defaultSegmentState.segment, index: true },
    modules: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...defaultSegmentState.modules }),
    },
    segmentConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ ...defaultSegmentState.segmentConfig }),
    },
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
    paymentSettings: {
      enabled: { type: Boolean, default: true },
      methods: {
        pix: { type: Boolean, default: false },
        creditCard: { type: Boolean, default: false },
        debitCard: { type: Boolean, default: false },
        cashOnPickup: { type: Boolean, default: true },
        cashOnDelivery: { type: Boolean, default: true },
      },
      pix: {
        key: { type: String, trim: true },
        merchantName: { type: String, trim: true },
        merchantCity: { type: String, trim: true },
      },
      provider: { type: String, enum: PAYMENT_PROVIDER_VALUES, default: 'manual', trim: true },
      mercadoPago: {
        enabled: { type: Boolean, default: false },
        publicKey: { type: String, trim: true },
        accessTokenEncrypted: { type: String, trim: true },
        webhookSecretEncrypted: { type: String, trim: true },
        accountEmail: { type: String, trim: true, lowercase: true },
        connectedAt: { type: Date, default: null },
      },
      asaas: {
        enabled: { type: Boolean, default: false },
        subaccountId: { type: String, trim: true },
        walletId: { type: String, trim: true },
        apiKeyEncrypted: { type: String, trim: true },
        accountEmail: { type: String, trim: true, lowercase: true },
        accountName: { type: String, trim: true },
        status: { type: String, trim: true, default: 'not_connected' },
        connectedAt: { type: Date, default: null },
        webhookAuthTokenEncrypted: { type: String, trim: true },
      },
      split: {
        enabled: { type: Boolean, default: false },
        platformFeePercent: { type: Number, default: 0, min: 0, max: 30 },
        platformWalletId: { type: String, trim: true },
        mode: { type: String, trim: true, default: 'percentage' },
        inheritsGlobal: { type: Boolean, default: true },
      },
    },
    seo: {
      title: { type: String, required: true, trim: true },
      description: { type: String, required: true, trim: true },
      imageUrl: { type: String, trim: true },
      imagePublicId: { type: String, trim: true },
    },
    history: [
      {
        field: { type: String, required: true, trim: true },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
        changedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  {
    ...baseSchemaOptions,
    toJSON: {
      ...baseSchemaOptions.toJSON,
      transform: (doc, ret) => {
        const transformed = baseToJSONTransform ? baseToJSONTransform(doc, ret) : ret;
        transformed.contact = normalizeBusinessContact(transformed.contact || {});
        transformed.paymentSettings = normalizeBusinessPaymentSettings(
          transformed.paymentSettings || {},
          transformed.contact?.pix || {},
        );
        return transformed;
      },
    },
    toObject: {
      ...baseSchemaOptions.toObject,
      transform: (doc, ret) => {
        const transformed = baseToObjectTransform ? baseToObjectTransform(doc, ret) : ret;
        transformed.contact = normalizeBusinessContact(transformed.contact || {});
        transformed.paymentSettings = normalizeBusinessPaymentSettings(
          transformed.paymentSettings || {},
          transformed.contact?.pix || {},
        );
        return transformed;
      },
    },
  },
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
