import { describe, expect, it } from 'vitest';
import {
  buildMeasurementDisplayQuantity,
  calculateMeasuredItemTotal,
} from '@shared/utils/productMeasurement.js';

describe('catalog pricing helpers', () => {
  it.each([
    [31.99, 0.1, 3.2],
    [31.99, 0.25, 8.0],
    [31.99, 0.333, 10.65],
    [31.99, 0.5, 16.0],
    [31.99, 0.75, 23.99],
    [31.99, 1, 31.99],
    [31.99, 2, 63.98],
    [19.9, 0.25, 4.98],
    [20.9, 0.4, 8.36],
    [39.99, 0.5, 20.0],
    [50.0, 0.333, 16.65],
  ])('rounds R$ %s with quantity %s to R$ %s', (unitPrice, quantity, expectedTotal) => {
    expect(calculateMeasuredItemTotal(unitPrice, quantity)).toBe(expectedTotal);
  });

  it.each([
    [0.1, '100g'],
    [0.25, '250g'],
    [0.333, '333g'],
    [0.5, '500g'],
    [0.75, '750g'],
    [1, '1kg'],
    [2, '2kg'],
  ])('formats kg quantities like shoppers expect for %s kg', (quantity, expectedLabel) => {
    expect(buildMeasurementDisplayQuantity(quantity, 'kg')).toBe(expectedLabel);
  });
});
