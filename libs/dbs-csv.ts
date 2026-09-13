import { parse } from "date-fns";
import { v5 as uuidv5 } from "uuid";

const DBS_NAMESPACE = "7c1e8f5a-2b4d-4e6f-9a1c-3d5e7f9b1a2c";
const REQUIRED_HEADER = [
  "Transaction Date",
  "Description",
  "Debit Amount",
  "Credit Amount",
];
const PAYLAH_TOP_UP = "TRF TOP-UP TO PAYLAH!";

export type DbsRow = {
  id: string;
  transactionDate: number;
  description: string;
  amount: number;
  notes: string;
};

export type DbsParseResult = { rows: DbsRow[]; unreadable: number };

// ponytail: RFC 4180 subset (quotes, doubled quotes, no newlines inside fields), DBS export never needs more
const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(field);
      field = "";
    } else field += ch;
  }
  out.push(field);
  return out;
};

export const dbsRowId = (rawLine: string) =>
  uuidv5(`dbs:${rawLine}`, DBS_NAMESPACE);

export const isPayLahTopUp = (description: string) =>
  description.startsWith(PAYLAH_TOP_UP);

export const parseDbsCsv = (text: string): DbsParseResult => {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    line.startsWith('"Transaction Date"'),
  );
  const header = headerIndex >= 0 ? splitCsvLine(lines[headerIndex]) : [];
  const col = Object.fromEntries(
    REQUIRED_HEADER.map((name) => [name, header.indexOf(name)]),
  );
  const codeCol = header.indexOf("Statement Code");
  if (REQUIRED_HEADER.some((name) => col[name] < 0)) {
    throw new Error("Not a DBS transaction history CSV: header row not found");
  }

  const rows: DbsRow[] = [];
  let unreadable = 0;
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    const fields = splitCsvLine(line);
    const date = parse(
      fields[col["Transaction Date"]] ?? "",
      "dd MMM yyyy",
      new Date(),
    );
    const debit = Number(fields[col["Debit Amount"]] || 0);
    const credit = Number(fields[col["Credit Amount"]] || 0);
    // Interest rows (ATINT) ship an empty description, fall back to the statement code
    const description =
      (fields[col["Description"]] ?? "").trim() ||
      (fields[codeCol] ?? "").trim();
    const amount = credit - debit;
    if (
      Number.isNaN(date.getTime()) ||
      !Number.isFinite(amount) ||
      amount === 0 ||
      !description
    ) {
      unreadable++;
      continue;
    }
    rows.push({
      id: dbsRowId(line),
      transactionDate: date.getTime(),
      description,
      amount,
      notes: line,
    });
  }
  return { rows, unreadable };
};
