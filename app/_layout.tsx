import React, { useEffect } from 'react';
import '@/libs/background';
import { Stack, router, usePathname } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'jotai';

import { db } from '@/db';
import { settings } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { AppRoot } from '@/components/app-root';
import {
  appQueryClient,
  hasProcessedLaunchTemplates,
  isLaunchTemplateProcessing,
  processLaunchTemplatesOnce,
  waitForLaunchTemplateProcessing,
} from '@/libs/app-runtime';
import { loadPreferences, preferenceStore } from '@/libs/preferences';

export {
  appQueryClient,
  processLaunchTemplatesOnce,
  reinitializeAppRuntime,
  resetLaunchTemplateProcessing,
  waitForLaunchTemplateProcessing,
} from '@/libs/app-runtime';

export async function initializeApp() {
  if (hasProcessedLaunchTemplates()) return;
  if (isLaunchTemplateProcessing()) return waitForLaunchTemplateProcessing();

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

  await processLaunchTemplatesOnce();
}

export default function RootLayout() {
  const pathname = usePathname();

  useEffect(() => {
    loadPreferences(preferenceStore);
  }, []);

  useEffect(() => {
    void initializeApp();
  }, [pathname]);

  return (
    <AppRoot>
      <Provider store={preferenceStore}>
        <QueryClientProvider client={appQueryClient}>
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
