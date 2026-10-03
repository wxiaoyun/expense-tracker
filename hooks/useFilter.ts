import { atom, getDefaultStore, useAtom } from "jotai";
import { debounce } from "lodash";
import { AppState } from "react-native";

export type DateRangePreset =
  "7d" | "30d" | "365d" | "monthly" | "weekly" | "all" | "custom";

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
export const endOfDay = (date: Date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );

export const dateRangeAtom = atom<DateRange>({
  preset: "all",
  start: new Date(0),
  end: endOfDay(now),
});

dateRangeAtom.onMount = (setDateRange) => {
  let midnightTimer: ReturnType<typeof setTimeout>;
  const refresh = () => {
    const today = new Date();
    setDateRange((current) => {
      if (
        current.preset === "custom" ||
        current.end.getTime() === endOfDay(today).getTime()
      ) {
        return current;
      }
      return { ...current, ...computeDateRange(current.preset, today) };
    });
    clearTimeout(midnightTimer);
    midnightTimer = setTimeout(
      refresh,
      endOfDay(today).getTime() - today.getTime() + 1,
    );
  };

  refresh();
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") refresh();
  });
  return () => {
    clearTimeout(midnightTimer);
    subscription.remove();
  };
};

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
export const computeDateRange = (
  preset: DateRangePreset,
  today: Date,
): { start: Date; end: Date } => {
  const end = endOfDay(today);
  switch (preset) {
    case "7d":
      return { start: new Date(today.getTime() - 7 * 24 * 3600 * 1000), end };
    case "30d":
      return { start: new Date(today.getTime() - 30 * 24 * 3600 * 1000), end };
    case "365d":
      return { start: new Date(today.getTime() - 365 * 24 * 3600 * 1000), end };
    case "monthly":
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end };
    case "weekly":
      const day = today.getDay(); // 0 = Sunday
      const diff = today.getDate() - day;
      return {
        start: new Date(today.getFullYear(), today.getMonth(), diff),
        end,
      };
    case "all":
      return { start: new Date(0), end };
    default:
      return { start: new Date(0), end };
  }
};
