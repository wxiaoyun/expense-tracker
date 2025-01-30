import { recurringTransactions } from "@/db";
import { RecurringTransactionSchema } from "@/db/recurring_transactions";
import transactions, { TransactionSchema } from "@/db/transactions";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { z } from "zod";
import { beforeCreate } from "./zod";

export const createTransactionCmdSchema = z.object({
  action: z.literal("create:transaction"),
  payload: TransactionSchema.omit(beforeCreate),
});
export type CreateTransactionCmd = z.infer<typeof createTransactionCmdSchema>;

export const createRecurringTransactionCmdSchema = z.object({
  action: z.literal("create:recurring"),
  payload: RecurringTransactionSchema.omit(beforeCreate),
});
export type CreateRecurringTransactionCmd = z.infer<
  typeof createRecurringTransactionCmdSchema
>;

export const clipboardCmdSchema = z.union([
  createTransactionCmdSchema,
  createRecurringTransactionCmdSchema,
]);
export type ClipboardCmd = z.infer<typeof clipboardCmdSchema>;

const isClipboardCmd = (str: string) => {
  return str.startsWith(CLIPBOARD_CMD_PREFIX);
};

export const clearClipboard = async () => {
  await writeText("");
};

const parseClipboardCmd = (cmd: string) => {
  const cmdStr = cmd.slice(CLIPBOARD_CMD_PREFIX.length);

  let deserialized: object;
  try {
    deserialized = JSON.parse(cmdStr);
  } catch (e) {
    console.error(
      "[Clipboard][parseClipboardCmd] failed to deserialize clipboard command as JSON: %o",
      e,
    );
    return null;
  }

  const parseResult = clipboardCmdSchema.safeParse(deserialized);
  if (!parseResult.success) {
    console.error(
      "[Clipboard][parseClipboardCmd] failed to parse clipboard command: %s",
      cmdStr,
    );
    return null;
  }

  console.info(
    "[Clipboard][parseClipboardCmd] parsed clipboard command: %o",
    parseResult.data,
  );
  return parseResult.data;
};

export const readClipboardAndExecuteCmd = async (): Promise<
  Result<Option<string>, string>
> => {
  const clipboardText = await readText();

  if (!isClipboardCmd(clipboardText)) {
    console.info(
      "[Clipboard][readClipboardAndExecuteCmd] ignored invalid clipboard command: %s",
      clipboardText,
    );
    return {
      ok: true,
      data: null,
    };
  }

  const cmd = parseClipboardCmd(clipboardText);
  if (!cmd) {
    return {
      ok: false,
      err: "Failed to parse clipboard command",
    };
  }

  console.info(
    "[Clipboard][readClipboardAndExecuteCmd] execute clipboard command: %o",
    cmd,
  );

  await clearClipboard();

  switch (cmd.action) {
    case "create:transaction":
      await transactions.create(cmd.payload);
      return {
        ok: true,
        data: "Created transaction from clipboard",
      };
    case "create:recurring":
      await recurringTransactions.create(cmd.payload);
      return {
        ok: true,
        data: "Created recurring transaction from clipboard",
      };
  }

  return {
    ok: false,
    err: "Unknown clipboard command",
  };
};
