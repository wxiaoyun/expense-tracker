import { DateRangeSetter } from "@/components/dateRangeSetter";
import { Separator } from "@/components/ui/separator";
import { TextField, TextFieldRoot } from "@/components/ui/textfield";
import { formatCurrency } from "@/libs/currency";
import { createTransactionSummarizeQuery } from "@/query/transactions";
import { useDateRange, useSearchTransactionParams } from "@/signals/params";
import { useCurrency } from "@/signals/setting";
import { debounce } from "lodash";
import { FaSolidPlus } from "solid-icons/fa";
import { IoSearch } from "solid-icons/io";
import { createMemo, createSignal } from "solid-js";
import { DOMElement } from "solid-js/jsx-runtime";
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
  const [currentQuery, setQuery] = useSearchTransactionParams();
  const [localQuery, setLocalQuery] = createSignal(currentQuery());

  const debouncedSetQuery = debounce(setQuery, 300);

  const handleChange = (
    e: InputEvent & {
      currentTarget: HTMLInputElement;
      target: DOMElement;
    },
  ) => {
    setLocalQuery(e.currentTarget.value);
    debouncedSetQuery(e.currentTarget.value);
  };

  return (
    <header class="relative flex flex-col">
      <div class="flex justify-between items-center gap-2">
        <div class="flex flex-col text-start">
          <span class="text-xs">
            From <b>{dateRange().start.toDateString()}</b>
          </span>
          <span class="text-xs">
            To <b>{dateRange().end.toDateString()}</b>
          </span>
        </div>
        <a href="/transactions/new">
          <FaSolidPlus
            class="cursor-pointer hover:opacity-65 transition-opacity"
            size={20}
          />
        </a>
      </div>

      <DateRangeSetter />

      <div class="flex items-center gap-2 self-center mb-1">
        <TextFieldRoot>
          <TextField
            class="h-fit"
            placeholder="Search"
            value={localQuery()}
            onInput={handleChange}
          />
        </TextFieldRoot>
        <IoSearch
          class="cursor-pointer hover:opacity-65 transition-opacity"
          size={20}
          onClick={() => setQuery(localQuery())}
        />
      </div>
    </header>
  );
};

const IntervalSummary = () => {
  const { dateRange } = useDateRange();
  const [currency] = useCurrency();
  const query = createTransactionSummarizeQuery(dateRange);

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
