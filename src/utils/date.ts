import { DAY, HOUR, MINUTE, MONTH, SECOND, YEAR } from "@/constants/date";
import {
  RecurrenceType,
  RecurringTransaction,
} from "@/db/recurring_transactions";
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
  const recurrenceType = transaction.recurrence_type;
  const recurrenceValue = transaction.recurrence_value;

  if (recurrenceType === "regular") {
    const interval = Number(recurrenceValue);
    return getNextRegularRecurrenceDate(lastCharged, interval);
  }

  return getNextCronRecurrenceDate(lastCharged, recurrenceValue);
};

const getNextRegularRecurrenceDate = (
  lastIncurredDate: Date,
  recurrenceInterval: number,
) => {
  const newDate = new Date(lastIncurredDate.getTime() + recurrenceInterval);
  return newDate;
};

const getNextCronRecurrenceDate = (
  lastIncurredDate: Date,
  cronExpression: string,
) => {
  const expression = parseExpression(cronExpression, {
    currentDate: new Date(lastIncurredDate),
  });
  const nextDate = expression.next().toDate();
  return nextDate;
};

export const occurrenceToText = (
  recurrenceType: RecurrenceType,
  recurrenceValue: string,
) => {
  if (recurrenceType === "regular") {
    const interval = Number(recurrenceValue);

    const years = Math.floor(interval / YEAR);
    const months = Math.floor((interval % YEAR) / MONTH);
    const days = Math.floor((interval % MONTH) / DAY);
    const hours = Math.floor((interval % DAY) / HOUR);
    const minutes = Math.floor((interval % HOUR) / MINUTE);
    const seconds = Math.floor((interval % MINUTE) / SECOND);

    const parts = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
    if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
    if (seconds > 0) parts.push(`${seconds} second${seconds > 1 ? "s" : ""}`);

    return "every " + parts.join(", ");
  }

  return `CronExp<${recurrenceValue}>`;
};

export const validateOccurrence = (
  recurrenceType: RecurrenceType,
  recurrenceValue: string,
) => {
  if (recurrenceType === "regular") {
    const num = Number(recurrenceValue);

    if (isNaN(num))
      return {
        ok: false,
        err: "Recurrence value must be a positive number",
      };

    if (num <= 0)
      return {
        ok: false,
        err: "Recurrence value must be a positive number",
      };

    return {
      ok: true,
    };
  }

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
