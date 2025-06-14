import * as Clipboard from "expo-clipboard";
import { z } from "zod";

import { createRecurringTransaction } from "@/db/recurring";
import { RecurringTransactionSchema, TransactionSchema } from "@/db/schema";
import { createTransaction } from "@/db/transaction";

const CLIPBOARD_CMD_PREFIX = "EXPENSE_TRACKER_CMD:";

const beforeCreate = {
  id: true,
  createdAt: true,
  updatedAt: true,
} as const;

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
  await Clipboard.setStringAsync("");
};

const parseClipboardCmd = (cmd: string) => {
  const cmdStr = cmd.slice(CLIPBOARD_CMD_PREFIX.length);
  console.info(
    "[Clipboard][parseClipboardCmd] parsing clipboard command: %s",
    cmdStr,
  );

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
      "[Clipboard][parseClipboardCmd] failed to parse clipboard command: ",
      parseResult.error,
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
  let clipboardText = "";

  try {
    clipboardText = await Clipboard.getStringAsync();
  } catch (e) {
    console.error(
      "[Clipboard][readClipboardAndExecuteCmd] failed to read clipboard text: %o",
      e,
    );
    return {
      ok: false,
      err: "Failed to read clipboard",
    };
  }

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
      try {
        await createTransaction(cmd.payload);
        return {
          ok: true,
          data: "Created transaction from clipboard",
        };
      } catch (error) {
        console.error("[Clipboard] Failed to create transaction:", error);
        return {
          ok: false,
          err: "Failed to create transaction",
        };
      }
    case "create:recurring":
      try {
        await createRecurringTransaction(cmd.payload);
        return {
          ok: true,
          data: "Created recurring transaction from clipboard",
        };
      } catch (error) {
        console.error(
          "[Clipboard] Failed to create recurring transaction:",
          error,
        );
        return {
          ok: false,
          err: "Failed to create recurring transaction",
        };
      }
  }
};

export const createClipboardCommand = (cmd: ClipboardCmd): string => {
  return CLIPBOARD_CMD_PREFIX + JSON.stringify(cmd);
};

export const setClipboardCommand = async (
  cmd: ClipboardCmd,
): Promise<boolean> => {
  try {
    const cmdString = createClipboardCommand(cmd);
    await Clipboard.setStringAsync(cmdString);
    return true;
  } catch (error) {
    console.error("[Clipboard] Failed to set clipboard command:", error);
    return false;
  }
};
