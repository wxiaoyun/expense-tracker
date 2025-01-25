import { ErrorComponent } from "@/components/error";
import { ToastList, ToastRegion } from "@/components/ui/toast";
import { EditTransactionPage, NewTransactionPage, RecurringTransactionPage, TransactionPage } from "@/pages";
import { queryClient } from "@/query";
import { ColorModeProvider, ColorModeScript } from "@kobalte/core";
import { Route, Router } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { ErrorBoundary } from "solid-js";
import { WorkInProgress } from "./components/workInProgress";
import { AppLayout } from "./layout";
import { SettingPage } from "./pages/setting";

export const App = () => (
  <ErrorBoundary fallback={ErrorComponent}>
    <ToastRegion>
      <ToastList />
    </ToastRegion>
    <ColorModeScript />
    <ColorModeProvider>
      <QueryClientProvider client={queryClient}>
        <Router root={AppLayout}>
          <Route path="/" component={TransactionPage} />

          <Route path="/transactions">
            <Route path="/" component={TransactionPage} />
            <Route path="/new" component={NewTransactionPage} />
            <Route path="/edit/:id" component={EditTransactionPage} />

            <Route path="/recurring">
              <Route
                path="/"
                component={RecurringTransactionPage}
              />
            </Route>
          </Route>

          <Route path="/summary" component={WorkInProgress} />

          <Route path="/settings" component={SettingPage} />
        </Router>
      </QueryClientProvider>
    </ColorModeProvider>
  </ErrorBoundary>
);
