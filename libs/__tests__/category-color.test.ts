import { CUSTOM_CATEGORY_PALETTE, customCategoryColor, hashCategoryName } from '../category-color';

describe('customCategoryColor', () => {
  it('is deterministic and case/whitespace insensitive', () => {
    expect(customCategoryColor('Pets')).toBe(customCategoryColor('Pets'));
    expect(customCategoryColor('Pets')).toBe(customCategoryColor('  pets '));
  });

  it('always returns a palette color', () => {
    for (const name of ['Pets', 'Gifts', 'Coffee', 'Rent', '', 'ü日本']) {
      expect(CUSTOM_CATEGORY_PALETTE).toContain(customCategoryColor(name));
    }
  });

  it('spreads distinct names across the palette', () => {
    const names = ['Pets', 'Gifts', 'Coffee', 'Gym', 'Books', 'Travel', 'Taxi', 'Gas'];
    const colors = new Set(names.map(customCategoryColor));
    expect(colors.size).toBeGreaterThan(3);
  });

  it('hash is a stable unsigned 32-bit integer', () => {
    const hash = hashCategoryName('Pets');
    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(2 ** 32);
  });
});
