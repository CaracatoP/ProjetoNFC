import { z } from 'zod';
import { adminBusinessEditorBodySchema } from './adminBusinessValidators.js';

export const clientPanelBusinessBasicsBodySchema = z.object({
  business: adminBusinessEditorBodySchema.shape.business
    .pick({
      name: true,
      legalName: true,
      description: true,
      logoUrl: true,
      logoPublicId: true,
      bannerUrl: true,
      bannerPublicId: true,
      badge: true,
      rating: true,
      address: true,
      hours: true,
      contact: true,
      seo: true,
    })
    .partial(),
});
