import { BusinessTheme } from '../models/BusinessTheme.js';

export async function findThemeByBusinessId(businessId) {
  return BusinessTheme.findOne({ businessId }).lean();
}

