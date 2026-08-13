export function toMoneyCents(value) {
  const numericValue = Number(value || 0);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.round(numericValue * 100);
}

export function fromMoneyCents(value) {
  const numericValue = Number(value || 0);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number((numericValue / 100).toFixed(2));
}

export function roundMoneyValue(value) {
  return fromMoneyCents(toMoneyCents(value));
}

export function multiplyMoneyByQuantity(unitPrice, quantity) {
  const normalizedQuantity = Number(quantity || 0);

  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    return 0;
  }

  return fromMoneyCents(Math.round(toMoneyCents(unitPrice) * normalizedQuantity));
}

export function sumMoneyValues(values = []) {
  return fromMoneyCents(
    (Array.isArray(values) ? values : []).reduce(
      (sum, value) => sum + toMoneyCents(value),
      0,
    ),
  );
}
