import { backupFilename, backupIntervalMinutes, hasExactColumns, hasSqliteHeader } from '../backup-core';

describe('backup core', () => {
  it('maps cadences to minute intervals', () => {
    expect(backupIntervalMinutes('daily')).toBe(1440);
    expect(backupIntervalMinutes('weekly')).toBe(10080);
  });
  it('builds filesystem-safe names', () => {
    expect(backupFilename(new Date('2026-08-11T01:02:03.000Z'))).toBe('expense-tracker-2026-08-11T01-02-03-000Z.db');
  });
  it('validates SQLite headers', () => {
    expect(hasSqliteHeader(new TextEncoder().encode('SQLite format 3\0data'))).toBe(true);
    expect(hasSqliteHeader(new TextEncoder().encode('not sqlite'))).toBe(false);
  });
  it('rejects missing, extra, or reordered restore columns', () => {
    expect(hasExactColumns(['id', 'amount'], ['id', 'amount'])).toBe(true);
    expect(hasExactColumns(['id'], ['id', 'amount'])).toBe(false);
    expect(hasExactColumns(['amount', 'id'], ['id', 'amount'])).toBe(false);
    expect(hasExactColumns(['id', 'amount', 'extra'], ['id', 'amount'])).toBe(false);
  });
});
