import { db } from './index';
import { categories, settings, transactionTemplates, transactions } from './schema';

export type ResetStage = 'transactions' | 'templates' | 'categories' | 'settings';

export class ResetDataError extends Error {
  constructor(readonly stage: ResetStage, cause: unknown) {
    super(`Reset failed while deleting ${stage}: ${String(cause)}`);
    this.name = 'ResetDataError';
  }
}

type ResetDatabase = {
  delete: (table: unknown) => { run: () => Promise<unknown> };
};

export async function resetAllData(
  database: ResetDatabase = db as unknown as ResetDatabase,
): Promise<void> {
  const targets: Array<{ stage: ResetStage; table: unknown }> = [
    { stage: 'transactions', table: transactions },
    { stage: 'templates', table: transactionTemplates },
    { stage: 'categories', table: categories },
    { stage: 'settings', table: settings },
  ];

  for (const { stage, table } of targets) {
    try {
      console.info(`[db.reset][stage=${stage}] deleting all rows`);
      await database.delete(table).run();
    } catch (error) {
      console.error('[db.reset] reset partially failed', { stage, error: String(error) });
      throw new ResetDataError(stage, error);
    }
  }
  console.info('[db.reset][stage=complete] local data reset');
}
