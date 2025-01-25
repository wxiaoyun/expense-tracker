import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TextField, TextFieldRoot } from "@/components/ui/textfield";
import {
  CURRENCY_SYMBOLS,
  DEFAULT_CURRENCY,
  DEFAULT_CURRENCY_SYMBOL,
} from "@/constants/settings";
import { Transaction } from "@/db/transactions";
import {
  useDateRange,
  useSearchTransactionParams,
  useTransactions,
} from "@/signals/params";
import { useCurrency } from "@/signals/setting";
import { DateRange, shiftDate } from "@/utils/date";
import { useNavigate } from "@solidjs/router";
import { debounce } from "lodash";
import { FaSolidPlus } from "solid-icons/fa";
import { HiSolidPencil } from "solid-icons/hi";
import { IoSearch } from "solid-icons/io";
import { TbChevronLeft, TbChevronRight } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";

export * from "./edit";
export * from "./new";
export * from "./recurring";

export const TransactionPage = () => {
  return (
    <main class="flex flex-col overflow-hidden">
      <Header />
      <TimeShift />
      <Separator />
      <IntervalSummary />
      <Separator />
      <TransactionList />
    </main>
  );
};

const Header = () => {
  const [currentQuery, setQuery] = useSearchTransactionParams();
  const [localQuery, setLocalQuery] = createSignal(currentQuery());

  const debouncedSetQuery = createMemo(() => debounce(setQuery, 400));

  const handleChange = (
    e: Event & {
      currentTarget: HTMLInputElement;
      target: HTMLInputElement;
    },
  ) => {
    setLocalQuery(e.target.value);
    debouncedSetQuery()(e.target.value);
  };

  return (
    <div class="relative p-1 flex justify-between items-center">
      <a href="/transactions/new">
        <FaSolidPlus
          class="cursor-pointer hover:opacity-65 transition-opacity"
          size={20}
        />
      </a>

      <TextFieldRoot>
        <TextField
          placeholder="Search"
          value={localQuery()}
          onChange={handleChange}
        />
      </TextFieldRoot>

      <IoSearch
        class="cursor-pointer hover:opacity-65 transition-opacity"
        size={20}
        onClick={() => setQuery(localQuery())}
      />
    </div>
  );
};

export const TimeShift = () => {
  const {
    currentDate: date,
    currentRange: range,
    setDate,
    setRange,
  } = useDateRange();

  const shift = (amount: number) => {
    const newDate = shiftDate(date(), range(), amount);
    setDate(newDate);
  };

  const rangeOptions: DateRange[] = ["daily", "weekly", "monthly", "yearly"];

  return (
    <section class="relative p-1 flex justify-between items-center">
      <TbChevronLeft
        class="cursor-pointer hover:opacity-65 transition-opacity"
        size={20}
        onClick={() => shift(-1)}
      />

      <div class="flex flex-col items-center">
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
          class="mb-1"
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
        <h2 class="text-sm">{date().toDateString()}</h2>
      </div>

      <TbChevronRight
        class="cursor-pointer hover:opacity-65 transition-opacity"
        size={20}
        onClick={() => shift(1)}
      />
    </section>
  );
};

export const IntervalSummary = () => {
  const query = useTransactions();

  const summary = createMemo(() => {
    if (!query().data) return { income: 0, expense: 0, balance: 0 };

    return query().data!.reduce(
      (acc, tx) => ({
        income: acc.income + (tx.amount > 0 ? tx.amount : 0),
        expense: acc.expense + (tx.amount < 0 ? -tx.amount : 0),
        balance: acc.balance + tx.amount,
      }),
      { income: 0, expense: 0, balance: 0 },
    );
  });

  return (
    <section class="p-1 flex justify-around text-sm">
      <div class="flex flex-col items-center">
        <h3>Income</h3>
        <p class="text-green-500">${summary().income.toFixed(2)}</p>
      </div>

      <div class="flex flex-col items-center">
        <h3>Expense</h3>
        <p class="text-red-500">${summary().expense.toFixed(2)}</p>
      </div>

      <div class="flex flex-col items-center">
        <h3>Balance</h3>
        <p class="text-blue-500">${summary().balance.toFixed(2)}</p>
      </div>
    </section>
  );
};

export const TransactionList = () => {
  const query = useTransactions();
  return (
    <section class="flex-1 overflow-auto">
      <Show when={query().isLoading}>
        <div class="p-4 text-center">Loading...</div>
      </Show>

      <Show when={query().isError}>
        <div class="p-4 text-center text-red-500">
          Error loading transactions
        </div>
      </Show>

      <Show when={query().data}>
        <For each={query().data}>
          {(t) => <TransactionItem transaction={t} />}
        </For>
      </Show>
    </section>
  );
};

const TransactionItem = (props: { transaction: Transaction }) => {
  const navigate = useNavigate();
  const [currency] = useCurrency();

  const isIncome = () => props.transaction.amount > 0;
  const formattedAmount = () => {
    const amount = Math.abs(props.transaction.amount);
    const sign = isIncome() ? "+" : "-";
    const currencyResolved = currency().data ?? DEFAULT_CURRENCY;
    const currencySymbol =
      CURRENCY_SYMBOLS[currencyResolved] ?? DEFAULT_CURRENCY_SYMBOL;
    return `${sign}${currencySymbol}${amount.toFixed(2)}`;
  };

  return (
    <div class="p-1 border-b flex justify-between gap-2 items-center">
      <div class="grow">
        <div class="flex justify-between items-center">
          <span>
            {new Date(props.transaction.transaction_date).toLocaleDateString()}
          </span>
          <span class={isIncome() ? "text-green-600" : "text-red-600"}>
            {formattedAmount()}
          </span>
        </div>
        <div class="flex justify-between items-center text-sm text-gray-600">
          <span>{props.transaction.description || "No description"}</span>
          <span>{props.transaction.category}</span>
        </div>
      </div>

      <HiSolidPencil
        class="text-muted-foreground cursor-pointer hover:opacity-65 transition-opacity"
        size={20}
        onClick={() => navigate(`/transactions/edit/${props.transaction.id}`)}
      />
    </div>
  );
};
