import { CronExpressionParser } from 'cron-parser';
import { format } from 'date-fns';

export const validateOccurrence = (value: string): { ok: boolean; error?: string } => {
  try {
    CronExpressionParser.parse(value);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
};

export const getNextOccurrences = (value: string, count = 3, startDate?: Date): Date[] => {
  try {
    const cron = CronExpressionParser.parse(value, {
      currentDate: startDate || new Date(),
    });
    const dates: Date[] = [];
    for (let i = 0; i < count; i++) {
      dates.push(cron.next().toDate());
    }
    return dates;
  } catch {
    return [];
  }
};

export const occurrenceToText = (value: string): string => {
  // Simple human-readable mapping for common cron patterns
  const map: Record<string, string> = {
    '0 0 * * *': 'Daily',
    '0 0 * * 0': 'Weekly',
    '0 0 1 * *': 'Monthly',
    '0 0 1 1 *': 'Yearly',
    '0 9 * * 1-5': 'Weekdays',
  };
  return map[value] || value;
};

export const getDateRange = (
  date: Date,
  range: '7d' | '30d' | '365d' | 'monthly' | 'weekly' | 'custom',
  weekStart: 0 | 1 = 0
): { start: Date; end: Date } => {
  switch (range) {
    case '7d':
      return { start: new Date(date.getTime() - 7 * 24 * 3600 * 1000), end: date };
    case '30d':
      return { start: new Date(date.getTime() - 30 * 24 * 3600 * 1000), end: date };
    case '365d':
      return { start: new Date(date.getTime() - 365 * 24 * 3600 * 1000), end: date };
    case 'monthly':
      return { start: new Date(date.getFullYear(), date.getMonth(), 1), end: date };
    case 'weekly':
      const day = date.getDay();
      const diff = date.getDate() - ((day - weekStart + 7) % 7);
      return { start: new Date(date.getFullYear(), date.getMonth(), diff), end: date };
    default:
      return { start: new Date(0), end: date };
  }
};

export const formatHumanDate = (date: Date | number): string => {
  return format(date, 'MMM d, yyyy');
};
