import { enumLabel, formatDate, formatMoney } from './format';

describe('formatMoney', () => {
  it('formats decimal strings with grouping and two decimals', () => {
    expect(formatMoney('12500.5', 'GHS')).toBe('GHS 12,500.50');
    expect(formatMoney('0', 'USD')).toBe('USD 0.00');
    expect(formatMoney(1234567.891, 'EUR')).toBe('EUR 1,234,567.89');
  });

  it('returns the raw value when it is not numeric', () => {
    expect(formatMoney('n/a', 'GHS')).toBe('GHS n/a');
  });
});

describe('formatDate', () => {
  it('renders dd/mm/yyyy', () => {
    expect(formatDate('2026-05-13T00:00:00.000Z')).toBe('13/05/2026');
  });

  it('handles missing values', () => {
    expect(formatDate(null)).toBe('—');
  });
});

describe('enumLabel', () => {
  it('converts enum values to sentence case', () => {
    expect(enumLabel('SETTLED_AND_PAID')).toBe('Settled and paid');
    expect(enumLabel('MOMO_STATEMENT')).toBe('Momo statement');
  });
});
