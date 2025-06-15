import { atom, getDefaultStore, useAtom } from "jotai";
import { debounce } from "lodash";
import { useMemo } from "react";

import { DateRange } from "@/constants";
import { getDateRange } from "@/libs/date";
import { useWeekStart } from "./useKv";

export const searchAtom = atom("");

export const useSearch = () => {
  return useAtom(searchAtom);
};

export const debouncedSetSearch = debounce((search: string) => {
  getDefaultStore().set(searchAtom, search);
}, 200);

export const dateAtom = atom(new Date());
export const rangeAtom = atom<DateRange>("monthly");

export const useDateRange = () => {
  const [date, setDate] = useAtom(dateAtom);
  const [range, setRange] = useAtom(rangeAtom);
  const [weekStart] = useWeekStart();

  const weekStartEnum = useMemo(() => {
    return weekStart === "monday" ? 1 : 0;
  }, [weekStart]);

  const dateRange = useMemo(
    () => getDateRange(date, range, weekStartEnum),
    [date, range, weekStartEnum],
  );

  return {
    date,
    range,
    dateRange,
    setDate,
    setRange,
  };
};

export const categoriesAtom = atom<string[]>([]);

export const useCategoryFilter = () => {
  return useAtom(categoriesAtom);
};

export const verifiedAtom = atom<boolean | null>(null);

export const useVerifiedFilter = () => {
  return useAtom(verifiedAtom);
};
