import { SystemSetting } from '../models/SystemSetting.js';

export const FINANCE_SETTINGS_KEY = 'finance:asaas';

export async function getFinanceSettingsRecord() {
  return SystemSetting.findOne({ key: FINANCE_SETTINGS_KEY });
}

export async function upsertFinanceSettingsRecord(value) {
  return SystemSetting.findOneAndUpdate(
    { key: FINANCE_SETTINGS_KEY },
    {
      $set: {
        key: FINANCE_SETTINGS_KEY,
        value,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
}
