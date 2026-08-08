import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db';
import { settings } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { router } from 'expo-router';
import { incurAllRecurringTransactions } from '@/db/recurring';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    const init = async () => {
      try {
        const result = await db.select().from(settings).where(sql`${settings.key} = 'app.migrated'`).get();
        if (!result || result.value !== '1') {
          router.replace('/migrate');
          return;
        }
        // Incur any pending recurring transactions
        await incurAllRecurringTransactions();
      } catch (error) {
        console.error("[INIT] Failed to check migration status:", error);
        router.replace('/migrate');
      }
    };
    init();
  }, []);

  return (
    <Provider>
      <QueryClientProvider client={queryClient}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="migrate" options={{ headerShown: false }} />
          <Stack.Screen name="(drawer)/transaction" options={{ presentation: 'modal' }} />
          <Stack.Screen name="(drawer)/recurring-edit" options={{ presentation: 'modal' }} />
       </Stack>
     </QueryClientProvider>
   </Provider>
  );
}
