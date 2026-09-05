/**
 * Palette for custom categories that have no row in the categories table.
 * Colors are picked deterministically from the category name so the same
 * custom category always renders with the same color across screens.
 */
export const CUSTOM_CATEGORY_PALETTE = [
  '#FF6B6B',
  '#F06595',
  '#CC5DE8',
  '#845EF7',
  '#5C7CFA',
  '#339AF0',
  '#22B8CF',
  '#20C997',
  '#51CF66',
  '#94D82D',
  '#FCC419',
  '#FF922B',
] as const;

/** FNV-1a 32-bit hash. Stable across platforms and JS engines. */
export const hashCategoryName = (name: string): number => {
  let hash = 0x811c9dc5;
  const normalized = name.trim().toLowerCase();
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

export const customCategoryColor = (name: string): string =>
  CUSTOM_CATEGORY_PALETTE[hashCategoryName(name) % CUSTOM_CATEGORY_PALETTE.length];
