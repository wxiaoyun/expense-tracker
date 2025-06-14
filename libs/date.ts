import { DateRange, WeekStartsOn } from "@/constants";
import { CronExpressionParser } from "cron-parser";

export const formatDate = (timestamp: number | Date): string => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      weekday: "short",
    });
  }
};

export const getDateRange = (
  date: Date,
  range: DateRange,
  weekStartsOn: WeekStartsOn = 1,
): { start: Date; end: Date } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  switch (range) {
    case "daily":
      return { start, end };
    case "weekly": {
      const currentDay = start.getDay();
      const daysToSubtract = (currentDay + 7 - weekStartsOn) % 7;
      start.setDate(start.getDate() - daysToSubtract);
      end.setDate(end.getDate() - daysToSubtract + 6);
      return { start, end };
    }
    case "monthly": {
      start.setDate(1);

      // Create a new date for the last day of the month
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      end.setFullYear(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
      );
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    case "yearly":
      start.setMonth(0, 1);
      end.setMonth(11, 31);
      return { start, end };
    case "all":
      start.setFullYear(0);
      end.setFullYear(9999);
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

export const getNextRecurrenceDate = (
  lastCharged: Date,
  recurrenceValue: string,
) => {
  const expression = CronExpressionParser.parse(recurrenceValue, {
    currentDate: lastCharged,
  });
  const nextDate = expression.next().toDate();
  return nextDate;
};

// TODO: Make this more readable
export const occurrenceToText = (recurrenceValue: string) => {
  return `CronExp<${recurrenceValue}>`;
};

export const validateOccurrence = (recurrenceValue: string) => {
  if (!recurrenceValue)
    return { ok: false, err: "Cron expression is required" };

  try {
    CronExpressionParser.parse(recurrenceValue);
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
