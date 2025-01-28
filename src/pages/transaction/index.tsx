import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TextField, TextFieldRoot } from "@/components/ui/textfield";
import { formatCurrency } from "@/libs/currency";
import { DateRange, shiftDate } from "@/libs/date";
import { createTransactionSummarizeQuery } from "@/query/transactions";
import { useDateRange, useSearchTransactionParams } from "@/signals/params";
import { useCurrency } from "@/signals/setting";
import { debounce } from "lodash";
import { FaSolidPlus } from "solid-icons/fa";
import { IoSearch } from "solid-icons/io";
import { TbChevronLeft, TbChevronRight } from "solid-icons/tb";
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
  const {
    currentDate: date,
    currentRange: range,
    dateRange,
    setDate,
    setRange,
  } = useDateRange();
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

  const shift = (amount: number) => {
    const newDate = shiftDate(date(), range(), amount);
    setDate(newDate);
  };

  const rangeOptions: DateRange[] = ["daily", "weekly", "monthly", "yearly"];

  return (
    <header class="relativeflex flex-col">
      <div class="flex justify-between items-center gap-2">
        <h1 class="text-lg font-semibold ml-2">Transactions</h1>

        <div class="flex items-center gap-2">
          <TextFieldRoot>
            <TextField
              class="h-fit"
              placeholder="Fuzzy search"
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
      </div>

      <div class="flex justify-between items-center gap-2">
        <div class="flex flex-col text-start ml-2">
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

      <div class="relative p-1 flex justify-center gap-6 items-center">
        <TbChevronLeft
          class="cursor-pointer hover:opacity-65 transition-opacity"
          size={32}
          onClick={() => shift(-1)}
        />

        <Select
          options={rangeOptions}
          value={range()}
          onChange={(value) => setRange(value as DateRange)}
          itemComponent={(props) => (
            <SelectItem item={props.item}>
              {props.item.rawValue.charAt(0).toUpperCase() +
                props.item.rawValue.slice(1)}
            </SelectItem>
          )}
          class="mb-1 h-fit"
        >
          <SelectTrigger class="w-32 h-8">
            <SelectValue<DateRange>>
              {(state) =>
                state.selectedOption()?.charAt(0).toUpperCase() +
                state.selectedOption()?.slice(1)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
        <TbChevronRight
          class="cursor-pointer hover:opacity-65 transition-opacity"
          size={32}
          onClick={() => shift(1)}
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
          currency: currency().data,
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
