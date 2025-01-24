import { createTransactionQuery } from "@/query/transactions";
import { DateRange, getDateRange } from "@/utils/date";
import { useSearchParams } from "@solidjs/router";
import Fuse from "fuse.js";
import { createMemo } from "solid-js";

export const useDateRange = () => {
  const [searchParams, setSearchParams] = useSearchParams<{
    date: string;
    range: DateRange;
  }>();

  if (!searchParams.date) {
    const now = new Date();
    setSearchParams({
      date: now.getTime().toString(),
      range: searchParams.range || "daily",
    });
  }

  const currentDate = () => new Date(Number(searchParams.date));
  const currentRange = () => (searchParams.range || "daily") as DateRange;
  const dateRange = () => getDateRange(currentDate(), currentRange());
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
  const setQuery = (query: string) => {
    // console.log("setting", query);
    setSearchParams({ query });
  };

  return [currentQuery, setQuery] as const;
};

export const useTransaction = () => {
  const { dateRange } = useDateRange();
  const [currentQuery] = useSearchTransactionParams();
  const query = createTransactionQuery(dateRange);

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
