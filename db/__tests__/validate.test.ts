/** @jest-environment node */

const mockOpenDatabaseSync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (...args: unknown[]) => mockOpenDatabaseSync(...args),
}));

import { V3_REQUIRED_COLUMNS } from '@/libs/backup-core';
import { quickValidateDatabase } from '../validate';

type QuickFixtureOptions = {
  integrity?: string;
  userVersion?: number;
  requiredTableCount?: number;
  transactionColumns?: readonly string[];
  templateColumns?: readonly string[];
  closeError?: Error;
};

const createFixture = ({
  integrity = 'ok',
  userVersion = 3,
  requiredTableCount = 4,
  transactionColumns = V3_REQUIRED_COLUMNS.transactions,
  templateColumns = V3_REQUIRED_COLUMNS.transaction_templates,
  closeError,
}: QuickFixtureOptions = {}) => ({
  getFirstSync: jest.fn((query: string) => {
    if (query === 'PRAGMA integrity_check') return { integrity_check: integrity };
    if (query === 'PRAGMA user_version') return { user_version: userVersion };
    if (query.includes('COUNT(*)') && query.includes('sqlite_master')) return { count: requiredTableCount };
    throw new Error(`unexpected scalar query: ${query}`);
  }),
  getAllSync: jest.fn((query: string) => {
    if (query === 'PRAGMA table_info(transactions)') {
      return transactionColumns.map((name) => ({ name }));
    }
    if (query === 'PRAGMA table_info(transaction_templates)') {
      return templateColumns.map((name) => ({ name }));
    }
    throw new Error(`unexpected list query: ${query}`);
  }),
  closeSync: jest.fn(() => {
    if (closeError) throw closeError;
  }),
});

describe('quick database validation', () => {
  beforeEach(() => {
    mockOpenDatabaseSync.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires integrity, four required tables, exact latest columns, and user_version 3', async () => {
    const fixture = createFixture();
    mockOpenDatabaseSync.mockReturnValue(fixture);
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await expect(quickValidateDatabase('/private/secret-database.db')).resolves.toBe(true);

    expect(info).toHaveBeenCalledWith('[db.quick_validate][stage=result] validation completed', {
      integrity_ok: true,
      required_table_count: 4,
      transaction_columns_ok: true,
      template_columns_ok: true,
      user_version_ok: true,
      valid: true,
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain('/private/secret-database.db');
    expect(fixture.closeSync).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['failed integrity', { integrity: 'corrupt' }],
    ['missing required table', { requiredTableCount: 3 }],
    ['stale version', { userVersion: 2 }],
    ['unsupported version', { userVersion: 4 }],
    ['old transaction columns', { transactionColumns: V3_REQUIRED_COLUMNS.transactions.filter((name) => name !== 'deleted_at') }],
    ['old template columns', { templateColumns: V3_REQUIRED_COLUMNS.transaction_templates.filter((name) => name !== 'deleted_at') }],
  ] satisfies Array<[string, QuickFixtureOptions]>)('rejects %s', async (_label, options) => {
    mockOpenDatabaseSync.mockReturnValue(createFixture(options));
    jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await expect(quickValidateDatabase('/not-logged.db')).resolves.toBe(false);
  });

  it('preserves fallback open behavior without logging the database path', async () => {
    const fixture = createFixture();
    mockOpenDatabaseSync
      .mockImplementationOnce(() => { throw new Error('primary open failure'); })
      .mockReturnValueOnce(fixture);
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await expect(quickValidateDatabase('/private/fallback.db')).resolves.toBe(true);

    expect(mockOpenDatabaseSync).toHaveBeenCalledTimes(2);
    expect(info).toHaveBeenCalledWith(
      '[db.quick_validate][stage=open_fallback] retrying database open',
      { primary_open_failed: true },
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain('/private/fallback.db');
  });

  it('reports a final fallback-open failure without exposing its path', async () => {
    mockOpenDatabaseSync.mockImplementation(() => { throw new Error('open failure'); });
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(quickValidateDatabase('/private/unopenable.db')).resolves.toBe(false);

    expect(mockOpenDatabaseSync).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(
      '[db.quick_validate][stage=open] database open failed',
      { error_type: 'Error' },
    );
    expect(JSON.stringify([...info.mock.calls, ...error.mock.calls])).not.toContain('/private/unopenable.db');
  });

  it('logs concise structured final and close failures without dumps or paths', async () => {
    const fixture = createFixture({ closeError: new Error('forced close failure') });
    mockOpenDatabaseSync.mockReturnValue(fixture);
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(quickValidateDatabase('/private/no-log.db')).resolves.toBe(true);

    expect(error).toHaveBeenCalledWith(
      '[db.quick_validate][stage=close] database close failed',
      { error_type: 'Error' },
    );
    const logs = JSON.stringify([...info.mock.calls, ...error.mock.calls]);
    expect(logs).not.toContain('/private/no-log.db');
    expect(logs).not.toContain('sqlite_master content');
    expect(logs).not.toContain('page_count');
    expect(logs).not.toContain('database_list');
  });
});
