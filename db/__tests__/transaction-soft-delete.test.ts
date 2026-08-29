/** @jest-environment node */

jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite');
  const database = new DatabaseSync(':memory:');

  const normalizeParams = (params?: unknown[]) => params ?? [];

  return {
    openDatabaseSync: () => ({
      execSync: (sql: string) => database.exec(sql),
      getFirstSync: (sql: string, ...params: unknown[]) => database.prepare(sql).get(...params) ?? null,
      getAllSync: (sql: string, ...params: unknown[]) => database.prepare(sql).all(...params),
      runSync: (sql: string, ...params: unknown[]) => database.prepare(sql).run(...params),
      prepareSync: (sql: string) => {
        const statement = database.prepare(sql);
        return {
          executeSync: (params?: unknown[]) => {
            const normalized = normalizeParams(params);
            const result = statement.run(...normalized);
            return {
              changes: result.changes,
              lastInsertRowId: Number(result.lastInsertRowid),
              getAllSync: () => statement.all(...normalized),
              getFirstSync: () => statement.get(...normalized) ?? null,
            };
          },
          executeForRawResultSync: (params?: unknown[]) => {
            const normalized = normalizeParams(params);
            return {
              getAllSync: () => statement.all(...normalized).map((row: Record<string, unknown>) => Object.values(row)),
            };
          },
        };
      },
      withTransactionSync: (task: () => void) => {
        database.exec('BEGIN');
        try {
          task();
          database.exec('COMMIT');
        } catch (error) {
          database.exec('ROLLBACK');
          throw error;
        }
      },
    }),
  };
});

import { eq } from 'drizzle-orm';

import { db, transactions } from '../index';
import {
  clearTransactions,
  getTransaction,
  listCategories,
  listTemplateSuggestionRows,
  listTransactions,
  setVerification,
  softDeleteTransaction,
  summarizeTransactions,
  updateTransaction,
} from '../transaction';

const fixtureRows = [
  {
    id: 'active',
    amount: -10,
    transactionDate: 200,
    description: 'Lunch',
    category: 'Food',
    templateId: null,
    verified: 0,
    notes: null,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'deleted',
    amount: -20,
    transactionDate: 300,
    description: 'Deleted travel',
    category: 'Travel',
    templateId: null,
    verified: 0,
    notes: null,
    deletedAt: 400,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'linked',
    amount: -5,
    transactionDate: 100,
    description: 'Linked lunch',
    category: 'Food',
    templateId: 'template-1',
    verified: 0,
    notes: null,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
  },
];

const seedTransactions = async () => {
  await clearTransactions();
  await db.insert(transactions).values(fixtureRows).run();
};

describe('transaction soft delete repository behavior', () => {
  beforeEach(async () => {
    await seedTransactions();
  });

  afterEach(async () => {
    await clearTransactions();
  });

  it('filters soft-deleted rows from normal reads while keeping linked active rows visible', async () => {
    expect((await listTransactions()).items.map((row) => row.id)).toEqual(['active', 'linked']);
    expect(await getTransaction('active')).toEqual(expect.objectContaining({ id: 'active' }));
    expect(await getTransaction('linked')).toEqual(expect.objectContaining({ id: 'linked', templateId: 'template-1' }));
    expect(await getTransaction('deleted')).toBeNull();
    expect(await summarizeTransactions()).toEqual({ balance: -15, income: 0, expense: -15 });
    expect(await listCategories()).toEqual(['Food']);
    const expectedSuggestionRows = [
      {
        amount: -10,
        transactionDate: 200,
        description: 'Lunch',
        category: 'Food',
      },
    ];
    expect(await listTemplateSuggestionRows(0)).toEqual(expectedSuggestionRows);
    expect(await listTemplateSuggestionRows(200)).toEqual(expectedSuggestionRows);
    expect(await listTemplateSuggestionRows(201)).toEqual([]);
  });

  it('soft deletes user transactions without removing the row physically', async () => {
    await expect(softDeleteTransaction('active', 500)).resolves.toBe(true);

    const raw = await db
      .select({ id: transactions.id, deletedAt: transactions.deletedAt, updatedAt: transactions.updatedAt })
      .from(transactions)
      .where(eq(transactions.id, 'active'))
      .get();

    expect(raw).toEqual({ id: 'active', deletedAt: 500, updatedAt: 500 });
    expect((await listTransactions()).items.map((row) => row.id)).toEqual(['linked']);
  });

  it('does not update or verify soft-deleted transactions', async () => {
    const deleted = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, 'deleted'))
      .get();

    expect(deleted).toBeDefined();
    await expect(updateTransaction({ ...deleted!, amount: -99 })).resolves.toBeNull();
    await expect(setVerification('deleted', 1)).resolves.toBe(false);

    const raw = await db
      .select({ amount: transactions.amount, verified: transactions.verified })
      .from(transactions)
      .where(eq(transactions.id, 'deleted'))
      .get();

    expect(raw).toEqual({ amount: -20, verified: 0 });
  });
});
