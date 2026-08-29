/** @jest-environment node */

import { getDueOccurrenceDates, templateOccurrenceId } from '../recurrence-core';

describe('recurring scheduler', () => {
  it('creates deterministic, occurrence-specific ids', () => {
    expect(templateOccurrenceId('rule', 123)).toBe(templateOccurrenceId('rule', 123));
    expect(templateOccurrenceId('rule', 123)).not.toBe(templateOccurrenceId('rule', 124));
  });
  it('returns every monthly occurrence after last charge through now', () => {
    const due = getDueOccurrenceDates(
      '0 0 1 * *',
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-04-15T00:00:00.000Z'),
      'UTC',
    );

    expect(due.map((date) => date.toISOString())).toEqual([
      '2026-02-01T00:00:00.000Z',
      '2026-03-01T00:00:00.000Z',
      '2026-04-01T00:00:00.000Z',
    ]);
  });

  it('returns no dates when next occurrence is in future', () => {
    expect(getDueOccurrenceDates(
      '0 0 1 * *',
      new Date('2026-04-01T00:00:00.000Z'),
      new Date('2026-04-15T00:00:00.000Z'),
      'UTC',
    )).toEqual([]);
  });

  it('returns no dates when rule starts in future', () => {
    expect(getDueOccurrenceDates(
      '0 0 1 * *',
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-08-11T00:00:00.000Z'),
      'UTC',
    )).toEqual([]);
  });

  it('rejects invalid cron expressions', () => {
    expect(() => getDueOccurrenceDates(
      'not a cron',
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-04-15T00:00:00.000Z'),
      'UTC',
    )).toThrow();
  });
});
