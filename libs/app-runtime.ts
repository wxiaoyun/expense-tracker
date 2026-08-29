import { QueryClient } from '@tanstack/react-query';

import { processScheduledTemplates } from '@/db/template';
import {
  loadPreferences,
  preferenceStore,
  resetPreferencesToDefaults,
} from '@/libs/preferences';

export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

let templateProcessingCompleted = false;
let templateProcessingPromise: Promise<void> | null = null;

export function waitForLaunchTemplateProcessing(): Promise<void> {
  return templateProcessingPromise ?? Promise.resolve();
}

export async function processLaunchTemplatesOnce(): Promise<void> {
  if (templateProcessingCompleted) return;
  if (templateProcessingPromise) return templateProcessingPromise;

  const processing = (async () => {
    try {
      console.info('[app.init][stage=process_templates] processing scheduled templates');
      await processScheduledTemplates();
    } catch (error) {
      console.error('[app.init][stage=process_templates] scheduled template processing failed', {
        error: String(error),
      });
    } finally {
      templateProcessingCompleted = true;
    }
  })();
  templateProcessingPromise = processing;
  try {
    await processing;
  } finally {
    if (templateProcessingPromise === processing) templateProcessingPromise = null;
  }
}

export function hasProcessedLaunchTemplates(): boolean {
  return templateProcessingCompleted;
}

export function isLaunchTemplateProcessing(): boolean {
  return templateProcessingPromise !== null;
}

export async function resetLaunchTemplateProcessing(): Promise<void> {
  await waitForLaunchTemplateProcessing();
  templateProcessingCompleted = false;
}

export async function reinitializeAppRuntime({
  processImportedSchedules = false,
}: { processImportedSchedules?: boolean } = {}): Promise<void> {
  await resetLaunchTemplateProcessing();
  appQueryClient.clear();
  resetPreferencesToDefaults(preferenceStore);
  loadPreferences(preferenceStore);
  if (processImportedSchedules) await processLaunchTemplatesOnce();
}
