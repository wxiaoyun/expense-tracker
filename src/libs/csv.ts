import transactions, { Transaction } from "@/db/transactions";
import { parse } from "@std/csv";
import { z } from "zod";

export const TransactionCsvSchema = z.tuple([
  z.coerce.number(),
  z.coerce.number().int().positive(),
  z.string(),
  z.string().optional(),
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
    fieldsPerRecord: 4,
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
