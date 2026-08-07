import { DEFAULT_PRODUCT_MEASUREMENT_UNIT } from '../constants/index.js';
import { normalizeMeasurementUnit } from './productMeasurement.js';

function normalizeNonNegativeNumber(value, fallback = 0) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }

  return Number(numericValue.toFixed(3));
}

export function normalizeProductInventory(inventory = {}, measurementUnit = DEFAULT_PRODUCT_MEASUREMENT_UNIT) {
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) {
    return {
      enabled: false,
      quantity: 0,
      minimumQuantity: 0,
      unit: normalizeMeasurementUnit(measurementUnit),
      notes: '',
    };
  }

  return {
    enabled: Boolean(inventory.enabled),
    quantity: normalizeNonNegativeNumber(inventory.quantity, 0),
    minimumQuantity: normalizeNonNegativeNumber(inventory.minimumQuantity, 0),
    unit: normalizeMeasurementUnit(inventory.unit || measurementUnit),
    notes: String(inventory.notes || '').trim(),
  };
}

export function normalizeProductAvailability(value) {
  return value !== false;
}

export function isInventoryBelowMinimum(inventory = {}) {
  if (!inventory?.enabled) {
    return false;
  }

  return Number(inventory.quantity || 0) <= Number(inventory.minimumQuantity || 0);
}
