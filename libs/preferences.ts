import { atom, getDefaultStore } from "jotai";
import { Appearance } from "react-native";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { SuggestionLookback } from "@/db/template-core";

export type { SuggestionLookback } from "@/db/template-core";
export type ThemePreference = "system" | "light" | "dark";
export type WeekStart = "sunday" | "monday";

export const isThemePreference = (
  value: string | null,
): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

export const DEFAULT_PREFERENCES = {
  currency: "USD",
  theme: "system" as ThemePreference,
  weekStart: "sunday" as WeekStart,
  suggestionLookback: "3m" as SuggestionLookback,
} as const;

export const currencyAtom = atom(DEFAULT_PREFERENCES.currency as string);
export const themeAtom = atom<ThemePreference>(DEFAULT_PREFERENCES.theme);
export const weekStartAtom = atom<WeekStart>(DEFAULT_PREFERENCES.weekStart);
export const suggestionLookbackAtom = atom<SuggestionLookback>(
  DEFAULT_PREFERENCES.suggestionLookback,
);
export const preferenceStore = getDefaultStore();

export function applyThemePreference(theme: ThemePreference) {
  console.info(
    "[preferences.theme][stage=apply_appearance] applying appearance",
    { theme },
  );
  try {
    Appearance.setColorScheme(theme === "system" ? "unspecified" : theme);
  } catch (error) {
    console.error(
      "[preferences.theme][stage=apply_appearance] appearance update failed",
      {
        theme,
        error: String(error),
      },
    );
  }
}

const PREF_KEYS = {
  currency: "pref.currency",
  theme: "pref.theme",
  weekStart: "pref.week_start",
  suggestionLookback: "pref.template_suggestion_lookback",
} as const;

export const SUGGESTION_LOOKBACK_OPTIONS: ReadonlyArray<{
  value: SuggestionLookback;
  label: string;
}> = [
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "12m", label: "12 months" },
  { value: "all", label: "All time" },
];
const SUGGESTION_LOOKBACK_VALUES = SUGGESTION_LOOKBACK_OPTIONS.map(
  ({ value }) => value,
);

const isSuggestionLookback = (
  value: string | null,
): value is SuggestionLookback =>
  value !== null &&
  SUGGESTION_LOOKBACK_VALUES.includes(value as SuggestionLookback);

function readSetting(key: string): string | null {
  console.info("[preferences.read][stage=query] reading setting", { key });
  try {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value ?? null;
  } catch (error) {
    console.error("[preferences.read][stage=query] setting read failed", {
      key,
      error: String(error),
    });
    return null;
  }
}

export function resetPreferencesToDefaults(store = preferenceStore) {
  store.set(currencyAtom, DEFAULT_PREFERENCES.currency);
  store.set(themeAtom, DEFAULT_PREFERENCES.theme);
  store.set(weekStartAtom, DEFAULT_PREFERENCES.weekStart);
  store.set(suggestionLookbackAtom, DEFAULT_PREFERENCES.suggestionLookback);
  applyThemePreference(DEFAULT_PREFERENCES.theme);
}

export function loadPreferences(store = preferenceStore) {
  const currency = readSetting(PREF_KEYS.currency);
  const theme = readSetting(PREF_KEYS.theme);
  const weekStart = readSetting(PREF_KEYS.weekStart);
  const suggestionLookback = readSetting(PREF_KEYS.suggestionLookback);

  store.set(currencyAtom, currency || DEFAULT_PREFERENCES.currency);
  const nextTheme = isThemePreference(theme)
    ? theme
    : DEFAULT_PREFERENCES.theme;
  store.set(themeAtom, nextTheme);
  applyThemePreference(nextTheme);
  store.set(
    weekStartAtom,
    weekStart === "sunday" || weekStart === "monday"
      ? weekStart
      : DEFAULT_PREFERENCES.weekStart,
  );
  store.set(
    suggestionLookbackAtom,
    isSuggestionLookback(suggestionLookback)
      ? suggestionLookback
      : DEFAULT_PREFERENCES.suggestionLookback,
  );
}

export async function savePreference(key: string, value: string) {
  console.info("[preferences.save][stage=upsert] saving setting", { key });
  try {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run();
  } catch (error) {
    console.error("[preferences.save][stage=upsert] setting save failed", {
      key,
      error: String(error),
    });
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
