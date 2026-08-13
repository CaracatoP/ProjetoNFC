import { z } from 'zod';
import {
  PAYMENT_ARCHITECTURE_VALUES,
  PAYMENT_PROVIDER_VALUES,
} from '../../../shared/constants/index.js';
import { objectIdSchema } from './objectId.js';

const optionalString = z.string().optional().or(z.literal(''));
const optionalNumber = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
}, z.number().finite().optional());

export const adminFinanceBusinessParamsSchema = z.object({
  businessId: objectIdSchema,
});

export const adminFinanceSettingsBodySchema = z.object({
  paymentArchitecture: z.enum(PAYMENT_ARCHITECTURE_VALUES).optional(),
  platformWalletId: optionalString,
  defaultPlatformFeePercent: optionalNumber,
});

export const adminBusinessFinanceBodySchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(PAYMENT_PROVIDER_VALUES).optional(),
  methods: z
    .object({
      pix: z.boolean().optional(),
      creditCard: z.boolean().optional(),
      debitCard: z.boolean().optional(),
      cashOnPickup: z.boolean().optional(),
      cashOnDelivery: z.boolean().optional(),
    })
    .optional(),
  asaas: z
    .object({
      enabled: z.boolean().optional(),
      subaccountId: optionalString,
      walletId: optionalString,
      accountEmail: z.string().email().optional().or(z.literal('')),
      accountName: optionalString,
      status: optionalString,
      apiKey: optionalString,
      clearApiKey: z.boolean().optional(),
    })
    .optional(),
  split: z
    .object({
      enabled: z.boolean().optional(),
      inheritsGlobal: z.boolean().optional(),
      platformFeePercent: optionalNumber,
    })
    .optional(),
});

export const adminBusinessFinanceSubaccountBodySchema = z
  .object({
    name: optionalString,
    email: optionalString,
    cpfCnpj: optionalString,
    companyType: optionalString,
    incomeValue: optionalNumber,
    phone: optionalString,
    mobilePhone: optionalString,
    site: optionalString,
    address: optionalString,
    addressNumber: optionalString,
    complement: optionalString,
    province: optionalString,
    postalCode: optionalString,
    birthDate: optionalString,
  })
  .passthrough();
