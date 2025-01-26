import { Separator } from "@/components/ui/separator";
import { recurringTransactions } from "@/db";
import { RecurringTransaction } from "@/db/recurring_transactions";
import { cn } from "@/libs/cn";
import { formatCurrency } from "@/libs/currency";
import { getNextRecurrenceDate, occurrenceToText } from "@/libs/date";
import { confirmationCallback } from "@/libs/dialog";
import { queryClient } from "@/query/query";
import {
  createIncurredRecurringTransactionListQuery,
  createRecurringTransactionListQuery,
  RECURRING_TRANSACTIONS_QUERY_KEY,
} from "@/query/recurring-transactions";
import { useNavigate } from "@solidjs/router";
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
    <div class="flex flex-col p-2 gap-4 overflow-y-auto">
      <Header />
      <RecurringTransactionList />
    </div>
  );
};

const Header = () => {
  const navigate = useNavigate();
  return (
    <header class="flex justify-between">
      <h1 class="text-lg font-semibold ml-2">Recurring Transactions</h1>
      <FaSolidPlus
        class="hover:opacity-65 transition-opacity cursor-pointer"
        size={20}
        onClick={() => navigate("/transactions/recurring/new")}
      />
    </header>
  );
};

const RecurringTransactionList = () => {
  const transactionsQuery = createRecurringTransactionListQuery(() => ({}));

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
        <For each={transactionsQuery.data}>
          {(t) => <RecurringTransactionCard transaction={t} />}
        </For>
      </Show>
    </div>
  );
};

const RecurringTransactionCard = (props: {
  transaction: RecurringTransaction;
}) => {
  const navigate = useNavigate();
  const isIncome = () => props.transaction.amount > 0;

  const incurredQuery = createIncurredRecurringTransactionListQuery(
    () => props.transaction.id,
  );
  const totalIncurred = createMemo(() => {
    const transactions = incurredQuery.data ?? [];
    return transactions.reduce((acc, curr) => acc + curr.amount, 0);
  });

  const nextChargeDate = () => getNextRecurrenceDate(props.transaction);

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
        queryClient.invalidateQueries({
          queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY],
        });
      },
    },
  );

  return (
    <div class="border rounded-lg p-4 space-y-4">
      <div class="flex justify-between items-start">
        <div>
          <h2 class="text-md font-semibold">{props.transaction.category}</h2>
          <Show when={props.transaction.description}>
            <p class="text-sm text-gray-600">{props.transaction.description}</p>
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

      <div class="flex justify-between items-start">
        <div>
          <span class="flex items-center gap-2 text-sm">
            <p>Amount</p>
            <p class={cn(isIncome() ? "text-green-600" : "text-red-600")}>
              {formatCurrency(props.transaction.amount)}
            </p>
          </span>

          <span class="flex items-center gap-2 text-sm">
            <p>Total Incurred</p>
            <p class={cn(isIncome() ? "text-green-600" : "text-red-600")}>
              {formatCurrency(totalIncurred())}
            </p>
          </span>
        </div>

        <div class="text-right text-xs opacity-80">
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
    </div>
  );
};
