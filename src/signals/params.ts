import { DateRange, getDateRange } from "@/libs/date";
import { createTransactionListQuery } from "@/query/transactions";
import { useSearchParams } from "@solidjs/router";
import Fuse from "fuse.js";
import { createMemo } from "solid-js";

export const useDateRange = () => {
  const [searchParams, setSearchParams] = useSearchParams<{
    date: string;
    range: DateRange;
  }>();

  const currentDate = createMemo(() => {
    if (!searchParams.date) {
      return new Date();
    }
    return new Date(Number(searchParams.date));
  });
  const currentRange = createMemo(
    () => (searchParams.range || "weekly") as DateRange,
  );
  const dateRange = createMemo(() =>
    getDateRange(currentDate(), currentRange()),
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

export const useTransactions = () => {
  const { dateRange } = useDateRange();
  const [currentQuery] = useSearchTransactionParams();
  const query = createTransactionListQuery(dateRange);

  const searched = createMemo(() => {
    const transactions = query.data ?? [];
    const f = new Fuse(transactions, {
      keys: ["category", "description"],
      threshold: 0.3,
    });
    const res = f.search(currentQuery());

    if (!currentQuery()) {
      return query;
    }

    return {
      ...query,
      data: res.map((r) => r.item),
    };
  });

  return searched;
};
