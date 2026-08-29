import { atom, getDefaultStore } from 'jotai';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { SuggestionLookback } from '@/db/template-core';

export type { SuggestionLookback } from '@/db/template-core';
export type ThemePreference = 'system' | 'light' | 'dark';
export type WeekStart = 'sunday' | 'monday';

export const currencyAtom = atom('USD');
export const themeAtom = atom<ThemePreference>('system');
export const weekStartAtom = atom<WeekStart>('sunday');
export const suggestionLookbackAtom = atom<SuggestionLookback>('3m');

const PREF_KEYS = {
  currency: 'pref.currency',
  theme: 'pref.theme',
  weekStart: 'pref.week_start',
  suggestionLookback: 'pref.template_suggestion_lookback',
} as const;

export const SUGGESTION_LOOKBACK_OPTIONS: ReadonlyArray<{
  value: SuggestionLookback;
  label: string;
}> = [
  { value: '1m', label: '1 month' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '12m', label: '12 months' },
  { value: 'all', label: 'All time' },
];
const SUGGESTION_LOOKBACK_VALUES = SUGGESTION_LOOKBACK_OPTIONS.map(({ value }) => value);

const isSuggestionLookback = (value: string | null): value is SuggestionLookback =>
  value !== null && SUGGESTION_LOOKBACK_VALUES.includes(value as SuggestionLookback);

function readSetting(key: string): string | null {
  console.info('[preferences.read][stage=query] reading setting', { key });
  try {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value ?? null;
  } catch (error) {
    console.error('[preferences.read][stage=query] setting read failed', { key, error: String(error) });
    return null;
  }
}

export function loadPreferences() {
  const store = getDefaultStore();
  const currency = readSetting(PREF_KEYS.currency);
  const theme = readSetting(PREF_KEYS.theme);
  const weekStart = readSetting(PREF_KEYS.weekStart);
  const suggestionLookback = readSetting(PREF_KEYS.suggestionLookback);
  if (currency) store.set(currencyAtom, currency);
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    store.set(themeAtom, theme);
  }
  if (weekStart === 'sunday' || weekStart === 'monday') {
    store.set(weekStartAtom, weekStart);
  }
  store.set(suggestionLookbackAtom, isSuggestionLookback(suggestionLookback) ? suggestionLookback : '3m');
}

export async function savePreference(key: string, value: string) {
  console.info('[preferences.save][stage=upsert] saving setting', { key });
  try {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run();
  } catch (error) {
    console.error('[preferences.save][stage=upsert] setting save failed', { key, error: String(error) });
    throw error;
  }
}

export async function savePreferenceAndApply(
  key: string,
  value: string,
  apply: () => void,
) {
  await savePreference(key, value);
  apply();
}

export const PREFERENCE_KEYS = PREF_KEYS;
