import { QueryClient } from "@tanstack/react-query";

import { processScheduledTemplates } from "@/db/template";
import { queryKeys } from "@/hooks/useTransactionsQuery";
import {
  loadPreferences,
  preferenceStore,
  resetPreferencesToDefaults,
} from "@/libs/preferences";

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
    let stage = "process_templates";
    try {
      console.info(
        "[app.init][stage=process_templates] processing scheduled templates",
      );
      const processed = await processScheduledTemplates();
      if (processed.length > 0) {
        stage = "invalidate_queries";
        console.info(
          "[app.init][stage=invalidate_queries] refreshing changed data",
          {
            stage,
            target: "templates",
            scheduled_count: processed.length,
          },
        );
        const invalidations = [
          appQueryClient.invalidateQueries({
            queryKey: queryKeys.templates.all(),
          }),
        ];
        if (
          processed.some(({ incurred }) => incurred !== null && incurred > 0)
        ) {
          invalidations.push(
            appQueryClient.invalidateQueries({
              queryKey: queryKeys.transactions.all(),
            }),
            appQueryClient.invalidateQueries({
              queryKey: queryKeys.categories.transactionList(),
            }),
          );
        }
        await Promise.all(invalidations);
      }
    } catch (error) {
      console.error(`[app.init][stage=${stage}] startup refresh failed`, {
        stage,
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
    if (templateProcessingPromise === processing)
      templateProcessingPromise = null;
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
