import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TextField, TextFieldRoot } from "@/components/ui/textfield";
import { DateRange, useTransactionQuery } from "@/query/transactions";
import { useSearchParams } from "@solidjs/router";
import { FaSolidPlus } from "solid-icons/fa";
import { IoSearch } from "solid-icons/io";
import { TbChevronLeft, TbChevronRight } from "solid-icons/tb";
import { For, Show } from "solid-js";

const getDateRange = (
  date: Date,
  range: DateRange,
): { start: Date; end: Date } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  switch (range) {
    case "daily":
      return { start, end };
    case "weekly":
      start.setDate(start.getDate() - start.getDay());
      end.setDate(end.getDate() + (6 - end.getDay()));
      return { start, end };
    case "monthly":
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      return { start, end };
    case "yearly":
      start.setMonth(0, 1);
      end.setMonth(11, 31);
      return { start, end };
  }
};

const shiftDate = (date: Date, range: DateRange, shift: number): Date => {
  const newDate = new Date(date);
  switch (range) {
    case "daily":
      newDate.setDate(newDate.getDate() + shift);
      break;
    case "weekly":
      newDate.setDate(newDate.getDate() + shift * 7);
      break;
    case "monthly":
      newDate.setMonth(newDate.getMonth() + shift);
      break;
    case "yearly":
      newDate.setFullYear(newDate.getFullYear() + shift);
      break;
  }
  return newDate;
};

export const Transaction = () => {
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

  const query = useTransactionQuery(dateRange);

  return (
    <main class="flex flex-col overflow-hidden">
      <Header />
      <TimeShift
        date={currentDate()}
        range={currentRange()}
        onDateChange={(date) =>
          setSearchParams({ date: date.getTime().toString() })
        }
        onRangeChange={(range) => setSearchParams({ range })}
      />
      <Separator />
      <IntervalSummary query={query} />
      <Separator />
      <TransactionList query={query} />
    </main>
  );
};

// TODO: Add search
const Header = () => {
  return (
    <form class="relative p-1 flex justify-between items-center">
      <a href="/transaction/new">
        <FaSolidPlus
          class="cursor-pointer hover:opacity-65 transition-opacity"
          size={20}
        />
      </a>

      <TextFieldRoot class="">
        <TextField class="" placeholder="Search" />
      </TextFieldRoot>

      <IoSearch
        class="cursor-pointer hover:opacity-65 transition-opacity"
        size={20}
      />
    </form>
  );
};

const TimeShift = (props: {
  date: Date;
  range: DateRange;
  onDateChange: (date: Date) => void;
  onRangeChange: (range: DateRange) => void;
}) => {
  const shift = (amount: number) => {
    const newDate = shiftDate(props.date, props.range, amount);
    props.onDateChange(newDate);
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
          value={props.range}
          onChange={(value) => props.onRangeChange(value as DateRange)}
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
        <h2 class="text-sm">{props.date.toDateString()}</h2>
      </div>

      <TbChevronRight
        class="cursor-pointer hover:opacity-65 transition-opacity"
        size={20}
        onClick={() => shift(1)}
      />
    </section>
  );
};

const IntervalSummary = (props: {
  query: ReturnType<typeof useTransactionQuery>;
}) => {
  const query = () => props.query;

  const summary = () => {
    if (!query().data) return { income: 0, expense: 0, balance: 0 };

    return query().data!.reduce(
      (acc, tx) => ({
        income: acc.income + (tx.amount > 0 ? tx.amount : 0),
        expense: acc.expense + (tx.amount < 0 ? -tx.amount : 0),
        balance: acc.balance + tx.amount,
      }),
      { income: 0, expense: 0, balance: 0 },
    );
  };

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

const TransactionList = (props: {
  query: ReturnType<typeof useTransactionQuery>;
}) => {
  const query = () => props.query;
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
          {(transaction) => (
            <div class="p-1 border-b">
              <div class="flex justify-between items-center">
                <span>
                  {new Date(transaction.transaction_date).toLocaleDateString()}
                </span>
                <span
                  class={
                    transaction.amount >= 0 ? "text-green-600" : "text-red-600"
                  }
                >
                  ${transaction.amount.toFixed(2)}
                </span>
              </div>
              <div class="flex justify-between items-center text-sm text-gray-600">
                <span>{transaction.description || "No description"}</span>
                <span>{transaction.category}</span>
              </div>
            </div>
          )}
        </For>
      </Show>
    </section>
  );
};
