/** @jest-environment node */

import { computeDateRange } from '../useFilter';

describe('computeDateRange', () => {
  it('includes transactions created later on selected end day', () => {
    const today = new Date(2026, 7, 11, 8, 59, 0, 0);

    const range = computeDateRange('all', today);

    expect(range.end).toEqual(new Date(2026, 7, 11, 23, 59, 59, 999));
  });
});
