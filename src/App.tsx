import { ToastList, ToastRegion } from "@/components/ui/toast";
import { ColorModeProvider, ColorModeScript } from "@kobalte/core";
import { Route, Router } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { ErrorBoundary } from "solid-js";
import { ErrorComponent } from "./components/error";
import { AppLayout } from "./layout";
import { RecurringTransaction, Settings, Summary } from "./pages";
import { TransactionPage } from "./pages/transaction";
import { EditTransactionPage } from "./pages/transaction/edit";
import { NewTransactionPage } from "./pages/transaction/new";
import { queryClient } from "./query";

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
          </Route>

          <Route
            path="/recurring_transactions"
            component={RecurringTransaction}
          />

          <Route path="/summary" component={Summary} />

          <Route path="/settings" component={Settings} />
        </Router>
      </QueryClientProvider>
    </ColorModeProvider>
  </ErrorBoundary>
);
