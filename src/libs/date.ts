import { RecurringTransaction } from "@/db/recurring_transactions";
import { parseExpression } from "cron-parser";

export type DateRange = "daily" | "weekly" | "monthly" | "yearly";

export const getDateRange = (
  date: Date,
  range: DateRange,
): { start: Date; end: Date } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  switch (range) {
    case "daily":
      return { start, end };
    case "weekly":
      start.setDate(start.getDate() - start.getDay());
      end.setDate(end.getDate() + (6 - end.getDay()));
      return { start, end };
    case "monthly":
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      return { start, end };
    case "yearly":
      start.setMonth(0, 1);
      end.setMonth(11, 31);
      return { start, end };
  }
};

export const shiftDate = (
  date: Date,
  range: DateRange,
  shift: number,
): Date => {
  const newDate = new Date(date);
  switch (range) {
    case "daily":
      newDate.setDate(newDate.getDate() + shift);
      break;
    case "weekly":
      newDate.setDate(newDate.getDate() + shift * 7);
      break;
    case "monthly":
      newDate.setMonth(newDate.getMonth() + shift);
      break;
    case "yearly":
      newDate.setFullYear(newDate.getFullYear() + shift);
      break;
  }
  return newDate;
};

export const getNextRecurrenceDate = (transaction: RecurringTransaction) => {
  const lastCharged = transaction.last_charged
    ? new Date(Number(transaction.last_charged))
    : new Date(Number(transaction.start_date));
  const recurrenceValue = transaction.recurrence_value;

  const expression = parseExpression(recurrenceValue, {
    currentDate: new Date(lastCharged),
  });
  const nextDate = expression.next().toDate();
  return nextDate;
};

// TODO: Make this more readable
export const occurrenceToText = (recurrenceValue: string) => {
  return `CronExp<${recurrenceValue}>`;
};

export const validateOccurrence = (recurrenceValue: string) => {
  try {
    parseExpression(recurrenceValue);
    return {
      ok: true,
    };
  } catch {
    return {
      ok: false,
      err: "Invalid cron expression",
    };
  }
};
