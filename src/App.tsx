import { ColorModeProvider, ColorModeScript } from "@kobalte/core";
import { Route, Router } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { ErrorBoundary } from "solid-js";
import { ErrorComponent } from "./components/error";
import { AppLayout } from "./layout";
import { RecurringTransaction, Settings, Summary } from "./pages";
import { Transaction } from "./pages/transaction";
import { queryClient } from "./query";

export const App = () => (
  <ErrorBoundary fallback={ErrorComponent}>
    <ColorModeScript />
    <ColorModeProvider>
      <QueryClientProvider client={queryClient}>
        <Router root={AppLayout}>
          <Route path="/" component={Transaction} />
          <Route path="/transactions" component={Transaction} />
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
