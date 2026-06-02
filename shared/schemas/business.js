import { z } from 'zod';
import {
  BUSINESS_MODULE_KEY_VALUES,
  BUSINESS_SEGMENT_VALUES,
  BUSINESS_STATUS_VALUES,
  DEFAULT_PAYMENT_PROVIDER,
  PAYMENT_PROVIDER_VALUES,
} from '../constants/index.js';
import { normalizeBusinessContact, normalizeBusinessWifi } from '../utils/businessContact.js';
import { normalizeBusinessPaymentSettings } from '../utils/businessPayment.js';

export const businessHourSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
});

export const businessAddressSchema = z.object({
  display: z.string().optional(),
  mapUrl: z.string().optional(),
  embedUrl: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const businessWifiSchema = z.preprocess(
  (value) => normalizeBusinessWifi(value),
  z.object({
    ssid: z.string().default(''),
    password: z.string().default(''),
    security: z.string().default('WPA'),
    title: z.string().default(''),
    description: z.string().default(''),
  }),
);

export const businessPixSchema = z.object({
  keyType: z.string(),
  key: z.string(),
  receiverName: z.string(),
  city: z.string(),
  description: z.string().optional(),
  actionLabel: z.string().optional(),
  actionDescription: z.string().optional(),
});

export const businessContactSchema = z.preprocess(
  (value) => normalizeBusinessContact(value),
  z.object({
    whatsapp: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    wifi: businessWifiSchema.default(normalizeBusinessWifi()),
    pix: businessPixSchema.optional(),
  }),
);

export const businessPaymentSettingsSchema = z.preprocess(
  (value) => normalizeBusinessPaymentSettings(value),
  z.object({
    enabled: z.boolean().default(true),
    methods: z
      .object({
        pix: z.boolean().default(false),
        creditCard: z.boolean().default(false),
        debitCard: z.boolean().default(false),
        cashOnPickup: z.boolean().default(true),
        cashOnDelivery: z.boolean().default(true),
      })
      .default({}),
    pix: z
      .object({
        key: z.string().default(''),
        merchantName: z.string().default(''),
        merchantCity: z.string().default(''),
      })
      .default({}),
    provider: z.enum(PAYMENT_PROVIDER_VALUES).default(DEFAULT_PAYMENT_PROVIDER),
    mercadoPago: z
      .object({
        enabled: z.boolean().default(false),
        publicKey: z.string().default(''),
        accountEmail: z.string().default(''),
        connected: z.boolean().default(false),
        hasAccessToken: z.boolean().default(false),
        hasWebhookSecret: z.boolean().default(false),
      })
      .default({}),
    asaas: z
      .object({
        enabled: z.boolean().default(false),
        subaccountId: z.string().default(''),
        walletId: z.string().default(''),
        accountEmail: z.string().default(''),
        accountName: z.string().default(''),
        status: z.string().default('not_connected'),
        connectedAt: z.date().nullable().optional(),
        connected: z.boolean().default(false),
        hasApiKey: z.boolean().default(false),
        hasWebhookAuthToken: z.boolean().default(false),
      })
      .default({}),
    split: z
      .object({
        enabled: z.boolean().default(false),
        platformFeePercent: z.number().min(0).max(30).default(0),
        platformWalletId: z.string().default(''),
        mode: z.string().default('percentage'),
        inheritsGlobal: z.boolean().default(true),
      })
      .default({}),
  }),
);

export const seoSchema = z.object({
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().optional(),
});

export const businessDomainsSchema = z.object({
  subdomain: z.string().optional().or(z.literal('')),
  customDomain: z.string().optional().or(z.literal('')),
  customDomainVerifiedAt: z.string().datetime().optional().nullable().or(z.literal('')),
});

export const businessSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  legalName: z.string().optional(),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  badge: z.string().optional(),
  status: z.enum(BUSINESS_STATUS_VALUES),
  address: businessAddressSchema.optional(),
  hours: z.array(businessHourSchema).default([]),
  rating: z.string().optional(),
  domains: businessDomainsSchema.default({}),
  contact: businessContactSchema.default(normalizeBusinessContact()),
  paymentSettings: businessPaymentSettingsSchema.default(normalizeBusinessPaymentSettings()),
  segment: z.enum(BUSINESS_SEGMENT_VALUES).default('other'),
  modules: z
    .object(
      BUSINESS_MODULE_KEY_VALUES.reduce((shape, key) => {
        shape[key] = z.boolean().default(false);
        return shape;
      }, {}),
    )
    .default({}),
  segmentConfig: z
    .object({
      label: z.string().optional(),
      description: z.string().optional(),
      catalogTitle: z.string().optional(),
      catalogDescription: z.string().optional(),
      appointmentTitle: z.string().optional(),
      appointmentDescription: z.string().optional(),
      loyaltyTitle: z.string().optional(),
      loyaltyDescription: z.string().optional(),
    })
    .passthrough()
    .default({}),
  seo: seoSchema,
});
