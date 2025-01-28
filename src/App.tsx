import { ErrorComponent } from "@/components/error";
import { ToastList, ToastRegion } from "@/components/ui/toast";
import {
  EditRecurringTransactionPage,
  EditTransactionPage,
  NewRecurringTransactionPage,
  NewTransactionPage,
  RecurringTransactionPage,
  SettingPage,
  TransactionPage,
} from "@/pages";
import { queryClient } from "@/query";
import { ColorModeProvider, ColorModeScript } from "@kobalte/core";
import { Route, Router } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { ErrorBoundary } from "solid-js";
import { AppLauncher } from "./components/launcher";
import { WorkInProgress } from "./components/workInProgress";
import { AppLayout } from "./layout";
import { initializePaths } from "./libs/fs";
import { incurDueRecurringTransactions } from "./utils/recurring-transactions";

const init = async () => {
  const res = await Promise.allSettled([
    initializePaths(),
    incurDueRecurringTransactions(),
  ]);

  if (res.every((r) => r.status === "fulfilled")) {
    console.info("[APP] App initialized");
    return;
  }

  console.error(
    "[APP] Failed to initialize paths or incur due recurring transactions",
  );
  throw new Error("Failed to initialize app");
};

export const App = () => {
  return (
    <ErrorBoundary fallback={ErrorComponent}>
      <ToastRegion>
        <ToastList />
      </ToastRegion>
      <ColorModeScript />
      <ColorModeProvider>
        <QueryClientProvider client={queryClient}>
          <AppLauncher init={init}>
            <Routes />
          </AppLauncher>
        </QueryClientProvider>
      </ColorModeProvider>
    </ErrorBoundary>
  );
};

const Routes = () => {
  return (
    <Router root={AppLayout}>
      <Route path="/" component={TransactionPage} />

      <Route path="/transactions">
        <Route path="/" component={TransactionPage} />
        <Route path="/new" component={NewTransactionPage} />
        <Route path="/edit/:id" component={EditTransactionPage} />

        <Route path="/recurring">
          <Route path="/" component={RecurringTransactionPage} />
          <Route path="/new" component={NewRecurringTransactionPage} />
          <Route path="/edit/:id" component={EditRecurringTransactionPage} />
        </Route>
      </Route>

      <Route path="/summary" component={WorkInProgress} />

      <Route path="/settings" component={SettingPage} />
    </Router>
  );
};
