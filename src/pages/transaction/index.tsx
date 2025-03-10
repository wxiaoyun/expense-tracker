import { DateRangeSetter } from "@/components/dateRangeSetter";
import { ParamsFilter } from "@/components/filter";
import { toastError, toastSuccess } from "@/components/toast";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/libs/currency";
import { exportCsvFromTransactions } from "@/libs/fs";
import { createTransactionSummarizeQuery } from "@/query/transactions";
import {
  useDateRange,
  useTransactionCategoryParams,
  useVerifiedTransactionParams,
} from "@/signals/params";
import { useCurrency } from "@/signals/setting";
import { FaSolidDownload, FaSolidPlus } from "solid-icons/fa";
import { createMemo } from "solid-js";
import { TransactionTable } from "./table";

export * from "./edit";
export * from "./new";
export * from "./recurring";

export const TransactionPage = () => {
  return (
    <main class="flex flex-col p-2 overflow-auto flex-grow">
      <Header />
      <Separator />
      <IntervalSummary />
      <Separator />
      <TransactionTable />
    </main>
  );
};

const Header = () => {
  const { dateRange } = useDateRange();

  return (
    <header class="relative flex flex-col">
      <div class="flex justify-between items-start gap-2">
        <div class="flex flex-col text-start">
          <span class="text-xs">
            From <b>{dateRange().start.toDateString()}</b>
          </span>
          <span class="text-xs">
            To <b>{dateRange().end.toDateString()}</b>
          </span>
        </div>

        <div class="flex items-center gap-2">
          <ExportButton />

          <ParamsFilter />

          <a href="/transactions/new">
            <FaSolidPlus
              class="cursor-pointer hover:opacity-65 transition-opacity"
              size={24}
            />
          </a>
        </div>
      </div>

      <DateRangeSetter />
    </header>
  );
};

const IntervalSummary = () => {
  const [currency] = useCurrency();
  const { dateRange } = useDateRange();
  const [categories] = useTransactionCategoryParams();
  const [verified] = useVerifiedTransactionParams();
  const verifiedNum = () => {
    if (verified() === "All") {
      return undefined;
    }
    return verified() === "Verified" ? 1 : 0;
  };

  const query = createTransactionSummarizeQuery(() => ({
    start: dateRange().start,
    end: dateRange().end,
    categories: categories(),
    verified: verifiedNum(),
  }));

  const summary = createMemo(() => {
    const summary = query.data ?? { income: 0, expense: 0, balance: 0 };

    return Object.fromEntries(
      Object.entries(summary).map(([key, value]) => [
        key,
        formatCurrency(value, {
          currency: currency(),
        }),
      ]),
    );
  });

  return (
    <section class="p-1 flex justify-around">
      <div class="flex flex-col items-center">
        <h3>Income</h3>
        <p class="text-green-500">{summary().income}</p>
      </div>

      <div class="flex flex-col items-center">
        <h3>Expense</h3>
        <p class="text-red-500">{summary().expense}</p>
      </div>

      <div class="flex flex-col items-center">
        <h3>Balance</h3>
        <p class="text-blue-500">{summary().balance}</p>
      </div>
    </section>
  );
};

const ExportButton = () => {
  const { dateRange } = useDateRange();
  const [selectedCategories] = useTransactionCategoryParams();
  const [verified] = useVerifiedTransactionParams();

  const verifiedNum = createMemo(() => {
    if (verified() === "All") {
      return undefined;
    }
    return verified() === "Verified" ? 1 : 0;
  });

  const exportOptions = createMemo(() => {
    return {
      start: dateRange().start,
      end: dateRange().end,
      limit: Number.MAX_SAFE_INTEGER,
      categories: selectedCategories(),
      orderBy: ["transaction_date", "DESC"],
      verified: verifiedNum(),
    } satisfies Parameters<typeof exportCsvFromTransactions>[0];
  });

  const handleExport = () => {
    exportCsvFromTransactions(exportOptions(), toastSuccess, toastError);
  };

  return (
    <FaSolidDownload
      class="cursor-pointer hover:opacity-65 transition-opacity"
      onClick={handleExport}
      size={24}
    />
  );
};
