jest.mock('jotai', () => ({
  getDefaultStore: () => ({ get: () => 'USD' }),
}));

jest.mock('../preferences', () => ({
  currencyAtom: {},
}));

import { formatCurrency } from '../intl';

describe('formatCurrency', () => {
  it('uses a compact dollar symbol for SGD', () => {
    expect(formatCurrency(-10.8, 'SGD')).toBe('-$10.80');
  });

  it('preserves USD dollar formatting', () => {
    expect(formatCurrency(16, 'USD')).toBe('$16.00');
  });
});
