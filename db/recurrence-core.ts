import { CronExpressionParser } from 'cron-parser';
import { v5 as uuidv5 } from 'uuid';

const OCCURRENCE_NAMESPACE = 'fb0b9233-e20b-4c20-95f7-82e7c6542d3f';
export const templateOccurrenceId = (templateId: string, transactionDate: number) =>
  uuidv5(`${templateId}:${transactionDate}`, OCCURRENCE_NAMESPACE);

export const getDueOccurrenceDates = (
  cronExpression: string,
  lastCharged: Date,
  now: Date,
  timeZone?: string,
): Date[] => {
  if (lastCharged.getTime() >= now.getTime()) return [];
  const expression = CronExpressionParser.parse(cronExpression, {
    currentDate: lastCharged,
    endDate: now,
    tz: timeZone,
  });
  const due: Date[] = [];

  while (true) {
    try {
      due.push(expression.next().toDate());
    } catch (error) {
      if (error instanceof Error && error.message.includes('Out of the time span range')) {
        return due;
      }
      throw error;
    }
  }
};
