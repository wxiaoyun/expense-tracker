import transactions, {
  Transaction,
  TransactionSchema,
} from "@/db/transactions";
import { parse } from "csv-parse/sync";
import { z } from "zod";

export const TransactionCsvSchema = z.tuple([
  TransactionSchema.shape.amount,
  TransactionSchema.shape.transaction_date,
  TransactionSchema.shape.category,
  TransactionSchema.shape.description,
]);

export type TransactionCsv = z.infer<typeof TransactionCsvSchema>;

export const generateCsvContent = async () => {
  const csvContent: TransactionCsv[] = [];
  let nextOffset: number | null = 0;

  while (nextOffset !== null) {
    const res = await transactions.list({
      limit: 300,
      offset: nextOffset,
    });
    nextOffset = res.nextOffset;

    csvContent.push(
      ...res.items.map(
        (item) =>
          [
            item.amount,
            item.transaction_date,
            item.category,
            item.description,
          ] satisfies TransactionCsv,
      ),
    );
  }

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
    trim: true,
    skip_empty_lines: true,
    delimiter: CSV_DELIMITER,
    quote: '"',
    cast: true,
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
          transaction_date: d[1],
          category: d[2],
          description: d[3],
        }) satisfies BeforeCreate<Transaction>,
    ),
  };
};
