import { Loader } from "@/components/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TextField, TextFieldRoot } from "@/components/ui/textfield";
import { DEFAULT_CURRENCY } from "@/constants/settings";
import transactions, { Transaction } from "@/db/transactions";
import { cn } from "@/libs/cn";
import { formatCurrency } from "@/libs/currency";
import { DateRange, shiftDate } from "@/libs/date";
import { confirmationCallback } from "@/libs/dialog";
import { queryClient } from "@/query";
import { TRANSACTIONS_QUERY_KEY } from "@/query/transactions";
import {
  useDateRange,
  useSearchTransactionParams,
  useTransactions,
} from "@/signals/params";
import { useCurrency } from "@/signals/setting";
import { useNavigate } from "@solidjs/router";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { debounce } from "lodash";
import { FaSolidPen, FaSolidPlus, FaSolidTrash } from "solid-icons/fa";
import { IoSearch } from "solid-icons/io";
import { TbChevronLeft, TbChevronRight } from "solid-icons/tb";
import {
  Component,
  ComponentProps,
  createMemo,
  createSignal,
  For,
  Show,
  splitProps,
} from "solid-js";

export * from "./edit";
export * from "./new";
export * from "./recurring";

export const TransactionPage = () => {
  return (
    <main class="flex flex-col p-2 overflow-auto">
      <Header />
      <Separator />
      <IntervalSummary />
      <Separator />
      <TransactionListWrapper />
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
    <section class="p-1 flex justify-around">
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

const TransactionListWrapper = () => {
  const query = useTransactions();

  return (
    <>
      <Show when={query().isLoading}>
        <Loader />
      </Show>

      <Show when={query().isError}>
        <div class="p-4 text-center text-red-500">
          Error loading transactions
        </div>
      </Show>

      <Show when={query().data}>
        <TransactionTable transactions={query().data!} />
      </Show>
    </>
  );
};

export const TransactionTable: Component<{
  transactions: Transaction[];
}> = (props) => {
  let el!: HTMLTableElement;

  const virtualizer = createVirtualizer({
    get count() {
      return props.transactions.length;
    },
    getScrollElement: () => el,
    estimateSize: () => 36,
    overscan: 20,
  });

  return (
    <Table class="flex-1 overflow-auto" ref={el}>
      <TableHeader class="block">
        <TableRow class="table table-fixed">
          <TableHead class="w-[100px]">Date</TableHead>
          <TableHead class="w-fit">Category</TableHead>
          <TableHead class="w-full">Description</TableHead>
          <TableHead class="w-fit whitespace-nowrap">Amount</TableHead>
          <TableHead class="w-fit">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody
        class="relative block w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        <For each={virtualizer.getVirtualItems()}>
          {(item) => (
            <TransactionItem
              transaction={props.transactions[item.index]}
              class="absolute table table-fixed top-0 left-0 w-full"
              style={{
                height: `${item.size}px`,
                transform: `translateY(${item.start}px)`,
              }}
            />
          )}
        </For>
      </TableBody>
    </Table>
  );
};

const TransactionItem: Component<
  ComponentProps<"tr"> & {
    transaction: Transaction;
  }
> = (props) => {
  const [local, rest] = splitProps(props, ["transaction", "class"]);
  const navigate = useNavigate();
  const [currency] = useCurrency();

  const isIncome = () => props.transaction.amount > 0;
  const formattedAmount = () =>
    formatCurrency(props.transaction.amount, {
      currency: currency().data ?? DEFAULT_CURRENCY,
    });

  const handleDelete = confirmationCallback(
    "This action will delete the transaction.",
    {
      title: "Are you sure?",
      okLabel: "Delete",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        await transactions.delete(props.transaction.id);
        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
      },
    },
  );

  return (
    <TableRow {...rest} class={cn("text-xs", local.class)}>
      <TableCell>
        {new Date(props.transaction.transaction_date).toLocaleDateString()}
      </TableCell>
      <TableCell>{props.transaction.category}</TableCell>
      <TableCell>{props.transaction.description || "-"}</TableCell>
      <TableCell
        class={cn(
          "whitespace-nowrap",
          isIncome() ? "text-green-600" : "text-red-600",
        )}
      >
        {formattedAmount()}
      </TableCell>
      <TableCell class="flex gap-2">
        <FaSolidPen
          class="text-blue-500 hover:text-blue-600 cursor-pointer transition-colors"
          size={20}
          onClick={() => navigate(`/transactions/edit/${props.transaction.id}`)}
        />
        <FaSolidTrash
          class="text-red-500 hover:text-red-600 cursor-pointer transition-colors"
          size={20}
          onClick={handleDelete}
        />
      </TableCell>
    </TableRow>
  );
};
