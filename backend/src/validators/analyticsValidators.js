import { analyticsEventSchema } from '../../../shared/schemas/index.js';

export const analyticsValidators = {
  createEvent: {
    body: analyticsEventSchema,
  },
};

