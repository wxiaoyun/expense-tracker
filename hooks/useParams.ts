import { DateRange } from "@/constants";
import { getDateRange } from "@/libs/date";
import { router } from "expo-router";
import { useLocalSearchParams } from "expo-router/build/hooks";
import { useMemo } from "react";
import { useWeekStart } from "./useKv";

export type UrlFilter = {
  search?: string;
  categories?: string[];
  verified?: boolean;
  date?: string;
  range?: DateRange;
};

export const useSearch = () => {
  const searchParams = useLocalSearchParams() as UrlFilter;
  const search = searchParams.search || "";
  const setSearch = (search: string) => router.setParams({ search });
  return [search, setSearch] as const;
};

export const useDateRange = () => {
  const searchParams = useLocalSearchParams() as UrlFilter;

  const [weekStart] = useWeekStart();
  const weekStartEnum = useMemo(() => {
    return weekStart === "monday" ? 1 : 0;
  }, [weekStart]);

  const currentDate = useMemo(() => {
    if (!searchParams.date) {
      return new Date();
    }
    return new Date(Number(searchParams.date));
  }, [searchParams.date]);
  const currentRange = useMemo(
    () => (searchParams.range || "monthly") as DateRange,
    [searchParams.range],
  );
  const dateRange = useMemo(
    () => getDateRange(currentDate, currentRange, weekStartEnum),
    [currentDate, currentRange, weekStartEnum],
  );
  const setDate = (date: Date) =>
    router.setParams({ date: date.getTime().toString() });
  const setRange = (range: DateRange) => router.setParams({ range });

  return {
    currentDate,
    currentRange,
    dateRange,
    setDate,
    setRange,
  };
};

export const useCategoryFilter = () => {
  const searchParams = useLocalSearchParams() as UrlFilter;
  const categories = searchParams.categories || [];
  const setCategories = (categories: string[]) =>
    router.setParams({ categories });
  return [categories, setCategories] as const;
};

export const useVerifiedFilter = () => {
  const searchParams = useLocalSearchParams() as UrlFilter;
  const verified = searchParams.verified || false;
  const setVerified = (verified: boolean) =>
    router.setParams({ verified: verified ? "true" : "false" });
  return [verified, setVerified] as const;
};
