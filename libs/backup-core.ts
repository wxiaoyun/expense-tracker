export type BackupCadence = 'daily' | 'weekly';
export const backupIntervalMinutes = (cadence: BackupCadence) => cadence === 'daily' ? 1440 : 10080;
export const backupFilename = (now: Date) => `expense-tracker-${now.toISOString().replace(/[:.]/g, '-')}.db`;
export const hasSqliteHeader = (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 16)) === 'SQLite format 3\0';
export const hasExactColumns = (actual: readonly string[], expected: readonly string[]) =>
  actual.length === expected.length && expected.every((name, index) => actual[index] === name);

export const V3_REQUIRED_COLUMNS: Record<string, readonly string[]> = {
  categories: ['id', 'name', 'icon', 'color', 'is_preset', 'sort_order', 'created_at'],
  settings: ['key', 'value'],
  transaction_templates: [
    'id',
    'name',
    'normalized_name',
    'amount',
    'transaction_type',
    'description',
    'category',
    'notes',
    'verified',
    'recurrence_value',
    'start_date',
    'schedule_cursor_at',
    'schedule_active',
    'deleted_at',
    'created_at',
    'updated_at',
  ],
  transactions: [
    'id',
    'amount',
    'transaction_date',
    'description',
    'category',
    'template_id',
    'verified',
    'notes',
    'deleted_at',
    'created_at',
    'updated_at',
  ],
};

export const V2_REQUIRED_COLUMNS: Record<string, readonly string[]> = {
  categories: ['id', 'name', 'icon', 'color', 'is_preset', 'sort_order', 'created_at'],
  settings: ['key', 'value'],
  recurring_transactions: [
    'id',
    'amount',
    'description',
    'category',
    'start_date',
    'last_charged',
    'recurrence_value',
    'created_at',
    'updated_at',
  ],
  transactions: [
    'id',
    'amount',
    'transaction_date',
    'description',
    'category',
    'recurring_transaction_id',
    'verified',
    'notes',
    'created_at',
    'updated_at',
  ],
};

export type BackupSchemaVersion = 2 | 3;

const hasExactSchema = (
  actual: Record<string, readonly string[]>,
  expected: Record<string, readonly string[]>,
) => {
  const actualTables = Object.keys(actual).sort();
  const expectedTables = Object.keys(expected).sort();
  return hasExactColumns(actualTables, expectedTables) && expectedTables.every((table) =>
    hasExactColumns(actual[table] ?? [], expected[table]),
  );
};

export const detectBackupSchemaVersion = (
  columnsByTable: Record<string, readonly string[]>,
  userVersion: number,
): BackupSchemaVersion | null => {
  if (userVersion === 3 && hasExactSchema(columnsByTable, V3_REQUIRED_COLUMNS)) return 3;
  if ((userVersion === 0 || userVersion === 2) && hasExactSchema(columnsByTable, V2_REQUIRED_COLUMNS)) return 2;
  return null;
};

export class DatabaseRollbackError extends Error {
  constructor(
    readonly restoreError: unknown,
    readonly rollbackError: unknown,
  ) {
    super(`Database replacement failed (${String(restoreError)}); rollback failed (${String(rollbackError)})`);
    this.name = 'DatabaseRollbackError';
  }
}

const safeErrorType = (error: unknown) =>
  error instanceof Error ? error.name : typeof error;

type RecoverySnapshotOptions<Recovery, Result> = {
  removeStaleRecovery: () => Promise<void>;
  openRecovery: () => Recovery;
  closeRecovery: (recovery: Recovery) => Promise<void>;
  deleteRecovery: () => Promise<void>;
  operation: (recovery: Recovery) => Promise<Result>;
};

export async function withRecoverySnapshot<Recovery, Result>({
  removeStaleRecovery,
  openRecovery,
  closeRecovery,
  deleteRecovery,
  operation,
}: RecoverySnapshotOptions<Recovery, Result>): Promise<Result> {
  console.info('[backup.restore][stage=prepare_recovery] preparing recovery database');
  await removeStaleRecovery();
  const recovery = openRecovery();
  let preserveRecovery = false;

  try {
    return await operation(recovery);
  } catch (error) {
    if (error instanceof DatabaseRollbackError) {
      preserveRecovery = true;
      console.error(
        '[backup.restore][stage=preserve_recovery] preserving recovery after rollback failure',
        {
          recovery_preserved: true,
          restore_error_type: safeErrorType(error.restoreError),
          rollback_error_type: safeErrorType(error.rollbackError),
        },
      );
    }
    throw error;
  } finally {
    try {
      console.info('[backup.restore][stage=close_recovery] closing recovery database');
      await closeRecovery(recovery);
    } catch (error) {
      console.error('[backup.restore][stage=close_recovery] recovery database close failed', {
        error_type: safeErrorType(error),
      });
    }

    if (!preserveRecovery) {
      try {
        console.info('[backup.restore][stage=cleanup_recovery] removing recovery database');
        await deleteRecovery();
      } catch (error) {
        console.error('[backup.restore][stage=cleanup_recovery] recovery database cleanup failed', {
          error_type: safeErrorType(error),
        });
      }
    }
  }
}

type ReplaceDatabaseWithRecoveryOptions<Database, Result> = {
  destination: Database;
  recovery: Database;
  copyDatabase: (source: Database, destination: Database) => Promise<void>;
  operation: () => Promise<Result>;
  validateRecovery: (database: Database) => void;
  validateDestination: (database: Database) => void;
};

export async function replaceDatabaseWithRecovery<Database, Result>({
  destination,
  recovery,
  copyDatabase,
  operation,
  validateRecovery,
  validateDestination,
}: ReplaceDatabaseWithRecoveryOptions<Database, Result>): Promise<Result> {
  console.info('[backup.restore][stage=create_recovery] creating live database recovery snapshot');
  await copyDatabase(destination, recovery);
  validateRecovery(recovery);

  try {
    const result = await operation();
    validateDestination(destination);
    return result;
  } catch (restoreError) {
    console.info('[backup.restore][stage=rollback] restoring live database recovery snapshot');
    try {
      await copyDatabase(recovery, destination);
      validateRecovery(destination);
      console.info('[backup.restore][stage=rollback] live database rollback completed');
    } catch (rollbackError) {
      console.error('[backup.restore][stage=rollback] live database rollback failed', {
        restore_error: String(restoreError),
        rollback_error: String(rollbackError),
      });
      throw new DatabaseRollbackError(restoreError, rollbackError);
    }
    throw restoreError;
  }
}

class UnsuccessfulDatabaseOperation<Result> extends Error {
  constructor(readonly result: Result) {
    super('Database operation returned an unsuccessful result');
    this.name = 'UnsuccessfulDatabaseOperation';
  }
}

type RecoverableDatabaseOperationOptions<Database, Result> = Omit<
  ReplaceDatabaseWithRecoveryOptions<Database, Result>,
  'operation'
> & {
  operation: () => Promise<Result>;
  isSuccess: (result: Result) => boolean;
};

/**
 * Extends the recovery boundary to result-based APIs. An unsuccessful result is
 * treated exactly like a throw so every live write is rolled back before the
 * original result is returned.
 */
export async function runRecoverableDatabaseOperation<Database, Result>({
  operation,
  isSuccess,
  ...recoveryOptions
}: RecoverableDatabaseOperationOptions<Database, Result>): Promise<Result> {
  try {
    return await replaceDatabaseWithRecovery({
      ...recoveryOptions,
      operation: async () => {
        const result = await operation();
        if (!isSuccess(result)) throw new UnsuccessfulDatabaseOperation(result);
        return result;
      },
    });
  } catch (error) {
    if (error instanceof UnsuccessfulDatabaseOperation) return error.result;
    throw error;
  }
}

type RestoreRecognizedBackupOptions<Database> = {
  sourceVersion: BackupSchemaVersion;
  source: Database;
  destination: Database;
  recovery: Database;
  copyDatabase: (source: Database, destination: Database) => Promise<void>;
  migrate: (destination: Database) => void;
  validateRecovery: (database: Database) => void;
  validateDestination: (database: Database) => void;
};

export async function restoreRecognizedBackup<Database>({
  sourceVersion,
  source,
  destination,
  recovery,
  copyDatabase,
  migrate,
  validateRecovery,
  validateDestination,
}: RestoreRecognizedBackupOptions<Database>): Promise<{
  mode: 'restore' | 'migrate';
  sourceVersion: BackupSchemaVersion;
}> {
  return replaceDatabaseWithRecovery({
    destination,
    recovery,
    copyDatabase,
    validateRecovery,
    validateDestination,
    operation: async () => {
      await copyDatabase(source, destination);
      if (sourceVersion === 2) migrate(destination);
      return {
        mode: sourceVersion === 2 ? 'migrate' as const : 'restore' as const,
        sourceVersion,
      };
    },
  });
}
