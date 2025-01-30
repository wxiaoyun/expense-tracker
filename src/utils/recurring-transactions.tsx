import {
  Toast,
  ToastContent,
  ToastDescription,
  ToastProgress,
  ToastTitle,
} from "@/components/ui/toast";
import recurringTransactions from "@/db/recurring_transactions";
import { queryClient } from "@/query";
import { RECURRING_TRANSACTIONS_QUERY_KEY } from "@/query/recurring-transactions";
import { TRANSACTIONS_QUERY_KEY } from "@/query/transactions";
import { toaster } from "@kobalte/core";

export const incurDueRecurringTransactions = async () => {
  console.info("[recurring-transactions] Incurring due recurring transactions");

  try {
    const transactions = await recurringTransactions.list();

    const incurred = await Promise.allSettled(
      transactions.map((t) => recurringTransactions.incur(t.id)),
    );

    if (incurred.some((result) => result.status === "rejected")) {
      console.error(
        "[recurring-transactions] Failed to incur some recurring transactions %o",
        incurred,
      );
      throw new Error(
        `[recurring-transactions] Failed to incur some recurring transactions %o`,
      );
    }

    const totalIncurred = incurred.reduce(
      // @ts-expect-error Already checked for fulfilled
      (acc, result) => acc + result.value,
      0,
    );

    console.info(
      "[recurring-transactions] Incurred %d recurring transactions",
      totalIncurred,
    );

    if (totalIncurred > 0) {
      toaster.show((props) => (
        <Toast {...props}>
          <ToastContent>
            <ToastTitle>Recurring Transactions Processed</ToastTitle>
            <ToastDescription>{`${totalIncurred} transaction${totalIncurred === 1 ? "" : "s"} have been automatically created.`}</ToastDescription>
          </ToastContent>
          <ToastProgress />
        </Toast>
      ));
    }

    queryClient.invalidateQueries({
      queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY],
    });
    queryClient.invalidateQueries({
      queryKey: [TRANSACTIONS_QUERY_KEY],
    });

    return totalIncurred;
  } catch (error) {
    console.error(
      "[recurring-transactions] Failed to process recurring transactions: %o",
      error,
    );
    toaster.show((props) => (
      <Toast {...props}>
        <ToastContent>
          <ToastTitle>Error Processing Transactions</ToastTitle>
          <ToastDescription>
            Failed to process recurring transactions. Please try again later.
          </ToastDescription>
        </ToastContent>
        <ToastProgress />
      </Toast>
    ));
    return 0;
  }
};
