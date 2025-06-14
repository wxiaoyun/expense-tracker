import { parse, stringify } from "@std/csv";
import { z } from "zod";

import { CSV_DELIMITER } from "@/constants";
import { NewTransaction, Transaction } from "@/db/schema";
import { listTransactions } from "@/db/transaction";


export const TransactionCsvSchema = z.tuple([
  z.coerce.number(),
  z.coerce.number().int().positive(),
  z.string(),
  z.string().optional(),
  z.coerce.number().optional(),
]);

export type TransactionCsv = z.infer<typeof TransactionCsvSchema>;

export const generateCsvContentFromDb = async () => {
  const csvContent: TransactionCsv[] = [];
  let nextOffset: number | null = 0;

  while (nextOffset !== null) {
    const res = await listTransactions({
      limit: 300,
      offset: nextOffset,
    });
    nextOffset = res.nextOffset;

    csvContent.push(
      ...res.items.map(
        (item) =>
          [
            item.amount,
            item.transactionDate,
            item.category,
            item.description ?? "",
            item.verified,
          ] satisfies TransactionCsv,
      ),
    );
  }

  console.info("[CSV][generateCsvContent] csvContent: ", csvContent);

  return csvContent
    .map((row) =>
      row
        .map((field) =>
          String(field).includes(CSV_DELIMITER) ? `"${field}"` : field,
        )
        .join(CSV_DELIMITER),
    )
    .join("\n");
};

export const parseCsvContent = (csvContentString: string) => {
  const records = parse(csvContentString, {
    separator: CSV_DELIMITER,
    trimLeadingSpace: true,
  });

  const schema = z.array(TransactionCsvSchema);

  const parseResult = schema.safeParse(records);

  if (!parseResult.success) {
    console.error(
      "[CSV][parseCsvContent] Failed to parse csv content: ",
      records,
      parseResult.error,
    );
    return {
      ok: false,
      err: parseResult.error,
    };
  }

  return {
    ok: true,
    data: parseResult.data.map(
      (d) =>
        ({
          amount: d[0],
          transactionDate: d[1],
          category: d[2],
          description: d[3],
          verified: d[4],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }) satisfies NewTransaction,
    ),
  };
};

export const generateCsvContent = (transactions: Transaction[]) => {
  const txs = transactions.map((tx) => ({
    amount: tx.amount,
    transaction_date: new Date(tx.transactionDate).toLocaleString(),
    category: tx.category,
    description: tx.description,
  }));

  return stringify(txs, {
    headers: true,
    columns: ["amount", "transaction_date", "category", "description"],
  });
};
