import {
  DEFAULT_PRODUCT_MEASUREMENT_UNIT,
  FRACTIONAL_PRODUCT_MEASUREMENT_UNIT_VALUES,
  INTEGER_PRODUCT_MEASUREMENT_UNIT_VALUES,
  PRODUCT_MEASUREMENT_UNIT_LABELS,
  PRODUCT_MEASUREMENT_UNIT_VALUES,
} from '../constants/products.js';
import { fromMoneyCents, multiplyMoneyByQuantity, toMoneyCents } from './money.js';

function formatNumber(value, options = {}) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: options.maximumFractionDigits ?? 3,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    useGrouping: options.useGrouping ?? true,
  }).format(Number(value || 0));
}

export function normalizeMeasurementUnit(value) {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase();

  return PRODUCT_MEASUREMENT_UNIT_VALUES.includes(normalizedValue)
    ? normalizedValue
    : DEFAULT_PRODUCT_MEASUREMENT_UNIT;
}

export function getMeasurementUnitLabel(value) {
  return PRODUCT_MEASUREMENT_UNIT_LABELS[normalizeMeasurementUnit(value)];
}

export function isFractionalMeasurementUnit(value) {
  return FRACTIONAL_PRODUCT_MEASUREMENT_UNIT_VALUES.includes(normalizeMeasurementUnit(value));
}

export function requiresIntegerMeasurementQuantity(value) {
  return INTEGER_PRODUCT_MEASUREMENT_UNIT_VALUES.includes(normalizeMeasurementUnit(value));
}

export function isValidMeasurementQuantity(value, measurementUnit) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return false;
  }

  if (requiresIntegerMeasurementQuantity(measurementUnit)) {
    return Number.isInteger(quantity);
  }

  return true;
}

export function normalizeProductMeasurement(product = {}) {
  return {
    ...product,
    measurementUnit: normalizeMeasurementUnit(product.measurementUnit),
  };
}

export function calculateMeasuredItemTotalCents(unitPrice, quantity) {
  const normalizedQuantity = Number(quantity || 0);

  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    return 0;
  }

  return Math.round(toMoneyCents(unitPrice) * normalizedQuantity);
}

export function calculateMeasuredItemTotal(unitPrice, quantity) {
  return multiplyMoneyByQuantity(unitPrice, quantity);
}

export function roundMeasuredItemTotal(value) {
  return fromMoneyCents(toMoneyCents(value));
}

export function buildMeasurementDisplayQuantity(quantity, measurementUnit) {
  const normalizedUnit = normalizeMeasurementUnit(measurementUnit);
  const numericQuantity = Number(quantity || 0);

  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    return '';
  }

  switch (normalizedUnit) {
    case 'kg': {
      const grams = numericQuantity * 1000;
      if (Math.abs(grams - Math.round(grams)) < 0.001) {
        const roundedGrams = Math.round(grams);

        if (roundedGrams % 1000 === 0) {
          return `${formatNumber(numericQuantity, {
            maximumFractionDigits: 0,
            useGrouping: false,
          })}kg`;
        }

        return `${formatNumber(roundedGrams, {
          maximumFractionDigits: 0,
          useGrouping: false,
        })}g`;
      }

      return `${formatNumber(numericQuantity)}kg`;
    }
    case 'g':
      return `${formatNumber(numericQuantity)}g`;
    case 'l':
      return `${formatNumber(numericQuantity)}L`;
    case 'ml':
      return `${formatNumber(numericQuantity)}ml`;
    case 'pack':
      return `${formatNumber(numericQuantity, { maximumFractionDigits: 0 })} ${numericQuantity === 1 ? 'pacote' : 'pacotes'}`;
    case 'box':
      return `${formatNumber(numericQuantity, { maximumFractionDigits: 0 })} ${numericQuantity === 1 ? 'caixa' : 'caixas'}`;
    case 'unit':
    default:
      return `${formatNumber(numericQuantity, { maximumFractionDigits: 0 })} ${numericQuantity === 1 ? 'unidade' : 'unidades'}`;
  }
}

export function buildMeasurementPriceSuffix(measurementUnit) {
  return `/${getMeasurementUnitLabel(measurementUnit)}`;
}

export function buildLegacyDisplayQuantity(quantity, measurementUnit) {
  return buildMeasurementDisplayQuantity(quantity, measurementUnit) || `${Number(quantity || 0)}x`;
}
