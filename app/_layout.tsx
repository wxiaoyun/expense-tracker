import React, { useEffect } from 'react';
import '@/libs/background';
import { Stack, router, usePathname } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';

import { db } from '@/db';
import { settings } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { processScheduledTemplates } from '@/db/template';
import { AppRoot } from '@/components/app-root';
import { loadPreferences } from '@/libs/preferences';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

let templateProcessingStarted = false;

export async function initializeApp() {
  if (templateProcessingStarted) return;

  try {
    console.info('[app.init][stage=check_migration] checking migration status');
    const result = await db.select().from(settings).where(sql`${settings.key} = 'app.migrated'`).get();
    if (!result || result.value !== '1') {
      router.replace('/migrate');
      return;
    }
  } catch (error) {
    console.error('[app.init][stage=check_migration] migration status check failed', { error: String(error) });
    router.replace('/migrate');
    return;
  }

  if (templateProcessingStarted) return;
  templateProcessingStarted = true;
  try {
    console.info('[app.init][stage=process_templates] processing scheduled templates');
    await processScheduledTemplates();
  } catch (error) {
    console.error('[app.init][stage=process_templates] scheduled template processing failed', {
      error: String(error),
    });
  }
}

export default function RootLayout() {
  const pathname = usePathname();

  useEffect(() => {
    loadPreferences();
  }, []);

  useEffect(() => {
    void initializeApp();
  }, [pathname]);

  return (
    <AppRoot>
      <Provider>
        <QueryClientProvider client={queryClient}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="migrate" options={{ headerShown: false }} />
            <Stack.Screen
              name="(drawer)/transaction"
              options={{ presentation: 'formSheet', headerShown: false, sheetGrabberVisible: true }}
            />
            <Stack.Screen
              name="(drawer)/template-edit"
              options={{ presentation: 'formSheet', headerShown: false, sheetGrabberVisible: true }}
            />
          </Stack>
        </QueryClientProvider>
      </Provider>
    </AppRoot>
  );
}
