import { atom, getDefaultStore } from 'jotai';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type ThemePreference = 'system' | 'light' | 'dark';
export type WeekStart = 'sunday' | 'monday';

export const currencyAtom = atom('USD');
export const themeAtom = atom<ThemePreference>('system');
export const weekStartAtom = atom<WeekStart>('sunday');

const PREF_KEYS = {
  currency: 'pref.currency',
  theme: 'pref.theme',
  weekStart: 'pref.week_start',
} as const;

function readSetting(key: string): string | null {
  try {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function loadPreferences() {
  const store = getDefaultStore();
  const currency = readSetting(PREF_KEYS.currency);
  const theme = readSetting(PREF_KEYS.theme);
  const weekStart = readSetting(PREF_KEYS.weekStart);
  if (currency) store.set(currencyAtom, currency);
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    store.set(themeAtom, theme);
  }
  if (weekStart === 'sunday' || weekStart === 'monday') {
    store.set(weekStartAtom, weekStart);
  }
}

export async function savePreference(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export const PREFERENCE_KEYS = PREF_KEYS;
