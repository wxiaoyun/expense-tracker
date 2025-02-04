import { ErrorComponent } from "@/components/error";
import { ToastList, ToastRegion } from "@/components/ui/toast";
import {
  EditRecurringTransactionPage,
  EditTransactionPage,
  NewRecurringTransactionPage,
  NewTransactionPage,
  RecurringTransactionPage,
  SettingPage,
  SummaryPage,
  TransactionPage,
} from "@/pages";
import { queryClient } from "@/query";
import { ColorModeProvider, ColorModeScript } from "@kobalte/core";
import { Route, Router } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { ErrorBoundary } from "solid-js";
import { AppLauncher } from "./components/launcher";
import { init } from "./init";
import { AppLayout } from "./layout";

export const App = () => {
  return (
    <ErrorBoundary fallback={ErrorComponent}>
      <ColorModeScript />
      <ColorModeProvider>
        <ToastRegion swipeDirection="right" duration={3000}>
          <ToastList />
        </ToastRegion>
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

      <Route path="/summary" component={SummaryPage} />

      <Route path="/settings" component={SettingPage} />
    </Router>
  );
};
