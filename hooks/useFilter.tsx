import { atom, getDefaultStore, useAtom } from "jotai";
import { debounce } from "lodash";
import { useMemo } from "react";

export type DateRangePreset = "7d" | "30d" | "365d" | "monthly" | "weekly" | "custom";

export type DateRange = {
  preset: DateRangePreset;
  start: Date;
  end: Date;
  customStart?: Date;
  customEnd?: Date;
};

export const searchAtom = atom("");

export const useSearch = () => {
  return useAtom(searchAtom);
};

export const debouncedSetSearch = debounce((search: string) => {
  getDefaultStore().set(searchAtom, search);
}, 200);

const now = new Date();

export const dateRangeAtom = atom<DateRange>({
  preset: "monthly",
  start: new Date(now.getFullYear(), now.getMonth(), 1),
  end: now,
});

export const useDateRange = () => {
  return useAtom(dateRangeAtom);
};

export const categoriesAtom = atom<string[]>([]);

export const useCategoryFilter = () => {
  return useAtom(categoriesAtom);
};

export const verifiedAtom = atom<boolean | null>(null);

export const useVerifiedFilter = () => {
  return useAtom(verifiedAtom);
};

// Filter combinator - shared between hook and tests
export const computeDateRange = (preset: DateRangePreset, today: Date): { start: Date; end: Date } => {
  switch (preset) {
    case "7d":
      return { start: new Date(today.getTime() - 7 * 24 * 3600 * 1000), end: today };
    case "30d":
      return { start: new Date(today.getTime() - 30 * 24 * 3600 * 1000), end: today };
    case "365d":
      return { start: new Date(today.getTime() - 365 * 24 * 3600 * 1000), end: today };
    case "monthly":
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
    case "weekly":
      const day = today.getDay(); // 0 = Sunday
      const diff = today.getDate() - day;
      return { start: new Date(today.getFullYear(), today.getMonth(), diff), end: today };
    default:
      return { start: new Date(0), end: today };
  }
};
