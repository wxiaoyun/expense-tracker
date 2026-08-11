import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { backupIntervalMinutes, type BackupCadence } from './backup-core';
import { createLocalBackup } from './backup';
import { runBackupTask } from './background-core';

export const BACKUP_TASK = 'expense-tracker-auto-backup';

if (!TaskManager.isTaskDefined(BACKUP_TASK)) {
  TaskManager.defineTask(BACKUP_TASK, async ({ error, executionInfo }) => {
    if (error) {
      console.error('[backup.background][stage=execute] task dispatch failed', { error: error.message, event_id: executionInfo.eventId });
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
    console.info('[backup.background][stage=execute] creating scheduled backup', { event_id: executionInfo.eventId });
    const result = await runBackupTask(createLocalBackup, BackgroundTask.BackgroundTaskResult.Success, BackgroundTask.BackgroundTaskResult.Failed, taskError => {
      console.error('[backup.background][stage=execute] scheduled backup failed', { error: String(taskError), event_id: executionInfo.eventId });
    });
    return result;
  });
}

export async function setAutoBackup(cadence: BackupCadence | null) {
  const registered = await TaskManager.isTaskRegisteredAsync(BACKUP_TASK);
  if (!cadence) {
    if (registered) await BackgroundTask.unregisterTaskAsync(BACKUP_TASK);
    console.info('[backup.background][stage=register][reason=disabled] auto-backup disabled');
    return;
  }
  console.info('[backup.background][stage=register] registering auto-backup', { cadence });
  await BackgroundTask.registerTaskAsync(BACKUP_TASK, { minimumInterval: backupIntervalMinutes(cadence) });
}
