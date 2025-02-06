import { DateRange, getDateRange } from "@/libs/date";
import { useSearchParams } from "@solidjs/router";
import { createMemo } from "solid-js";
import { useWeekStart } from "./setting";

export const useDateRange = () => {
  const [searchParams, setSearchParams] = useSearchParams<{
    date: string;
    range: DateRange;
  }>();

  const [weekStart] = useWeekStart();
  const weekStartEnum = createMemo(() => {
    return weekStart() === "monday" ? 1 : 0;
  });

  const currentDate = createMemo(() => {
    if (!searchParams.date) {
      return new Date();
    }
    return new Date(Number(searchParams.date));
  });
  const currentRange = createMemo(
    () => (searchParams.range || "monthly") as DateRange,
  );
  const dateRange = createMemo(() =>
    getDateRange(currentDate(), currentRange(), weekStartEnum()),
  );
  const setDate = (date: Date) =>
    setSearchParams({ date: date.getTime().toString() });
  const setRange = (range: DateRange) => setSearchParams({ range });

  return {
    currentDate,
    currentRange,
    dateRange,
    setDate,
    setRange,
  };
};

export const useSearchTransactionParams = () => {
  const [searchParams, setSearchParams] = useSearchParams<{
    query: string;
  }>();

  const currentQuery = () => searchParams.query || "";
  const setQuery = (query: string) => setSearchParams({ query });

  return [currentQuery, setQuery] as const;
};

export const useTransactionCategoryParams = () => {
  const [searchParams, setSearchParams] = useSearchParams<{
    transaction_categories: string[];
  }>();

  const currentCategories = createMemo(() => {
    if (typeof searchParams.transaction_categories === "string") {
      return [searchParams.transaction_categories];
    }
    return searchParams.transaction_categories || [];
  });
  const setCategories = (categories: string[]) =>
    setSearchParams({ transaction_categories: categories });

  return [currentCategories, setCategories] as const;
};

export type VerifiedTransactionParams = "All" | "Verified" | "Unverified";

export const useVerifiedTransactionParams = () => {
  const [searchParams, setSearchParams] = useSearchParams<{
    verified: VerifiedTransactionParams;
  }>();

  const currentVerified = createMemo(() => {
    if (
      !["All", "Verified", "Unverified"].includes(searchParams.verified ?? "")
    ) {
      return "All";
    }
    return searchParams.verified as VerifiedTransactionParams;
  });

  const setVerified = (verified: VerifiedTransactionParams) =>
    setSearchParams({ verified });

  return [currentVerified, setVerified] as const;
};
