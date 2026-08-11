export type BackupCadence = 'daily' | 'weekly';
export const backupIntervalMinutes = (cadence: BackupCadence) => cadence === 'daily' ? 1440 : 10080;
export const backupFilename = (now: Date) => `expense-tracker-${now.toISOString().replace(/[:.]/g, '-')}.db`;
export const hasSqliteHeader = (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 16)) === 'SQLite format 3\0';
export const hasExactColumns = (actual: string[], expected: string[]) =>
  actual.length === expected.length && expected.every((name, index) => actual[index] === name);
