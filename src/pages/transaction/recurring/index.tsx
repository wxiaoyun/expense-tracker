import { ParamsFilter } from "@/components/filter";
import { Separator } from "@/components/ui/separator";
import { recurringTransactions } from "@/db";
import { RecurringTransaction } from "@/db/recurring_transactions";
import { cn } from "@/libs/cn";
import { formatCurrency } from "@/libs/currency";
import { getNextRecurrenceDate, occurrenceToText } from "@/libs/date";
import { confirmationCallback } from "@/libs/dialog";
import {
  createIncurredRecurringTransactionListQuery,
  createRecurringTransactionListQuery,
  invalidateRecurringTransactionsQueries,
} from "@/query/recurring-transactions";
import {
  useSearchTransactionParams,
  useTransactionCategoryParams,
} from "@/signals/params";
import { useCurrency } from "@/signals/setting";
import { useNavigate } from "@solidjs/router";
import Fuse from "fuse.js";
import {
  FaSolidPen,
  FaSolidPlus,
  FaSolidSpinner,
  FaSolidTrash,
} from "solid-icons/fa";
import { createMemo, For, Show } from "solid-js";

export * from "./edit";
export * from "./new";

export const RecurringTransactionPage = () => {
  return (
    <div class="flex flex-col p-2 gap-4 overflow-y-auto flex-grow">
      <Header />
      <RecurringTransactionList />
    </div>
  );
};

const Header = () => {
  const navigate = useNavigate();
  return (
    <header class="flex justify-between items-start">
      <h1 class="text-lg font-semibold ml-2">Recurring Transactions</h1>

      <div class="flex items-center gap-2">
        <ParamsFilter hideVerified />
        <FaSolidPlus
          class="hover:opacity-65 transition-opacity cursor-pointer"
          size={24}
          onClick={() => navigate("/transactions/recurring/new")}
        />
      </div>
    </header>
  );
};

const RecurringTransactionList = () => {
  const [categories] = useTransactionCategoryParams();
  const [query] = useSearchTransactionParams();

  const transactionsQuery = createRecurringTransactionListQuery(() => ({
    categories: categories(),
  }));

  const filteredRecurringTransactions = createMemo(() => {
    const transactions = transactionsQuery.data ?? [];

    if (query().length === 0) {
      return transactions;
    }

    const fuse = new Fuse(transactions, {
      keys: [
        "category",
        "description",
      ] satisfies (keyof RecurringTransaction)[],
    });

    const result = fuse.search(query());
    return result.map((r) => r.item);
  });

  return (
    <div class="flex flex-col gap-2">
      <Show when={transactionsQuery.isLoading}>
        <div class="flex justify-center items-center h-full">
          <FaSolidSpinner class="animate-spin" size={20} />
        </div>
      </Show>

      <Show when={transactionsQuery.isError}>
        <div class="flex justify-center items-center h-full">
          <p>Error loading transactions</p>
        </div>
      </Show>

      <Show when={transactionsQuery.isSuccess}>
        <For each={filteredRecurringTransactions()}>
          {(t) => <RecurringTransactionCard transaction={t} />}
        </For>
        <Show when={filteredRecurringTransactions().length === 0}>
          <div class="flex justify-center items-center h-full">
            <p class="text-xs text-muted-foreground">
              No recurring transactions found
            </p>
          </div>
        </Show>
      </Show>
    </div>
  );
};

const RecurringTransactionCard = (props: {
  transaction: RecurringTransaction;
}) => {
  const navigate = useNavigate();
  const [currency] = useCurrency();
  const isIncome = () => props.transaction.amount > 0;

  const incurredQuery = createIncurredRecurringTransactionListQuery(
    () => props.transaction.id,
  );
  const totalIncurred = createMemo(() => {
    const transactions = incurredQuery.data ?? [];
    return transactions.reduce((acc, curr) => acc + curr.amount, 0);
  });

  const nextChargeDate = () =>
    getNextRecurrenceDate(
      new Date(props.transaction.last_charged ?? props.transaction.start_date),
      props.transaction.recurrence_value,
    );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const handleDelete = confirmationCallback(
    "This action will delete the recurring transaction.",
    {
      title: "Are you sure?",
      okLabel: "Delete",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        await recurringTransactions.delete(props.transaction.id);
        invalidateRecurringTransactionsQueries();
      },
    },
  );

  return (
    <div class="border rounded-lg p-4 space-y-4">
      <div class="flex justify-between items-start">
        <div>
          <h2 class="text-md font-semibold">{props.transaction.category}</h2>
          <Show when={props.transaction.description}>
            <p class="text-sm text-muted-foreground">
              {props.transaction.description}
            </p>
          </Show>
        </div>

        <div class="flex items-center gap-2">
          <FaSolidPen
            class="text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
            size={20}
            onClick={() =>
              navigate(`/transactions/recurring/edit/${props.transaction.id}`)
            }
          />

          <FaSolidTrash
            class="text-red-500 hover:text-red-600 transition-colors"
            size={20}
            onClick={handleDelete}
          />
        </div>
      </div>

      <Separator />

      <div>
        <span class="flex items-center gap-2">
          <p class="text-xs text-muted-foreground">Amount</p>
          <p
            class={cn(
              "text-xs font-semibold",
              isIncome() ? "text-green-600" : "text-red-600",
            )}
          >
            {formatCurrency(props.transaction.amount, {
              currency: currency(),
            })}
          </p>
        </span>

        <span class="flex items-center gap-2">
          <p class="text-xs text-muted-foreground">Total Incurred</p>
          <p
            class={cn(
              "text-xs font-semibold",
              isIncome() ? "text-green-600" : "text-red-600",
            )}
          >
            {formatCurrency(totalIncurred(), {
              currency: currency(),
            })}
          </p>
        </span>
      </div>

      <Separator />

      <div class="text-left text-xs text-muted-foreground">
        <p>Started: {formatDate(props.transaction.start_date)}</p>
        <Show when={props.transaction.last_charged}>
          <p>Last charged: {formatDate(props.transaction.last_charged!)}</p>
        </Show>
        <p>Next charge: {nextChargeDate().toLocaleDateString()}</p>
        <p>
          Recurrence: {occurrenceToText(props.transaction.recurrence_value)}
        </p>
      </div>
    </div>
  );
};
