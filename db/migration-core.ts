import { v5 as uuidv5 } from 'uuid';

const MIGRATION_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export type LegacyTransaction = {
  id: number;
  amount: number;
  transaction_date: number;
  description: string;
  category: string;
  recurring_transaction_id: number | null;
  verified: number;
  created_at: number;
  updated_at: number;
};

export type LegacyRecurring = {
  id: number;
  amount: number;
  description: string;
  category: string;
  start_date: number;
  last_charged: number | null;
  recurrence_value: string;
  created_at: number;
  updated_at: number;
};

export const generateMigrationUUID = (legacyId: number): string =>
  uuidv5(String(legacyId), MIGRATION_NAMESPACE);

export const mapLegacyTransaction = (transaction: LegacyTransaction) => ({
  id: generateMigrationUUID(transaction.id),
  amount: transaction.amount,
  transactionDate: transaction.transaction_date,
  description: transaction.description,
  category: transaction.category,
  recurringTransactionId: transaction.recurring_transaction_id === null
    ? null
    : generateMigrationUUID(transaction.recurring_transaction_id),
  verified: transaction.verified,
  notes: null,
  createdAt: transaction.created_at,
  updatedAt: transaction.updated_at,
});

export const mapLegacyRecurring = (transaction: LegacyRecurring) => ({
  id: generateMigrationUUID(transaction.id),
  amount: transaction.amount,
  description: transaction.description,
  category: transaction.category,
  startDate: transaction.start_date,
  lastCharged: transaction.last_charged,
  recurrenceValue: transaction.recurrence_value,
  createdAt: transaction.created_at,
  updatedAt: transaction.updated_at,
});

export const splitIntoMigrationBatches = <T>(rows: T[], batchSize = 1000): T[][] => {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('Migration batch size must be a positive integer');
  }

  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    batches.push(rows.slice(index, index + batchSize));
  }
  return batches;
};
