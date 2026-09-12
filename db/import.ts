import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from './index';
import { transactions } from './schema';
import { isPayLahTopUp, type DbsRow } from '@/libs/dbs-csv';

export type ImportResult = { imported: number; skipped: number };

const categoryFor = async (description: string): Promise<string> => {
  if (isPayLahTopUp(description)) return 'PayLah!';
  const match = await db
    .select({ category: transactions.category })
    .from(transactions)
    .where(and(eq(transactions.description, description), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.transactionDate))
    .limit(1)
    .get();
  return match?.category ?? 'Other';
};

export const importDbsRows = async (rows: DbsRow[]): Promise<ImportResult> => {
  const now = Date.now();
  let imported = 0;
  console.info('[import.dbs][stage=insert_rows] importing rows', { count: rows.length });
  try {
    for (const row of rows) {
      const result = await db
        .insert(transactions)
        .values({
          id: row.id,
          amount: row.amount,
          transactionDate: row.transactionDate,
          description: row.description,
          category: await categoryFor(row.description),
          verified: 0,
          notes: row.notes,
          source: 'dbs',
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .run();
      imported += result.changes;
    }
  } catch (error) {
    console.error('[import.dbs][stage=insert_rows] import failed', { imported, error: String(error) });
    throw error;
  }
  return { imported, skipped: rows.length - imported };
};
