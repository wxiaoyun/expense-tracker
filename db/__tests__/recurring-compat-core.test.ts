/** @jest-environment node */

import {
  mapRecurringToScheduledTemplate,
  mapScheduledTemplateToRecurring,
} from '../recurring-compat-core';

describe('recurring compatibility mapping', () => {
  it('maps signed recurring amounts into positive template magnitudes and back', () => {
    const template = mapRecurringToScheduledTemplate({
      id: 'rule-1',
      amount: -25,
      description: ' Gym ',
      category: 'Health',
      startDate: 100,
      lastCharged: null,
      recurrenceValue: '0 0 1 * *',
      createdAt: 10,
      updatedAt: 20,
    }, ['gym']);

    expect(template).toEqual(expect.objectContaining({
      name: 'Gym 2',
      normalizedName: 'gym 2',
      amount: 25,
      transactionType: 'expense',
      scheduleCursorAt: 100,
      scheduleActive: 1,
    }));
    expect(mapScheduledTemplateToRecurring(template)).toEqual({
      id: 'rule-1',
      amount: -25,
      description: ' Gym ',
      category: 'Health',
      startDate: 100,
      lastCharged: 100,
      recurrenceValue: '0 0 1 * *',
      createdAt: 10,
      updatedAt: 20,
    });
  });

  it('rejects zero, non-finite, and non-numeric compatibility amounts', () => {
    const recurring = {
      id: 'rule-invalid',
      amount: 0,
      description: 'Invalid',
      category: 'Other',
      startDate: 100,
      lastCharged: null,
      recurrenceValue: '0 0 1 * *',
      createdAt: 10,
      updatedAt: 20,
    };

    expect(() => mapRecurringToScheduledTemplate(recurring, [])).toThrow('Amount must be greater than zero');
    expect(() => mapRecurringToScheduledTemplate({ ...recurring, amount: Number.NaN }, [])).toThrow('Amount must be greater than zero');
    expect(() => mapRecurringToScheduledTemplate({ ...recurring, amount: Number.POSITIVE_INFINITY }, [])).toThrow('Amount must be greater than zero');
    expect(() => mapRecurringToScheduledTemplate({ ...recurring, amount: Number.NEGATIVE_INFINITY }, [])).toThrow('Amount must be greater than zero');
  });

  it('uses the preserved id when a compatibility description is whitespace-only', () => {
    expect(mapRecurringToScheduledTemplate({
      id: 'rule-blank',
      amount: -10,
      description: '  ',
      category: 'Other',
      startDate: 100,
      lastCharged: null,
      recurrenceValue: '0 0 1 * *',
      createdAt: 10,
      updatedAt: 20,
    }, [])).toEqual(expect.objectContaining({
      name: 'Template rule-blank',
      normalizedName: 'template rule-blank',
      description: '  ',
    }));
  });

  it('does not expose incomplete reusable templates as recurring rules', () => {
    expect(mapScheduledTemplateToRecurring({
      id: 'draft',
      amount: null,
      transactionType: null,
      description: null,
      category: null,
      startDate: null,
      scheduleCursorAt: null,
      recurrenceValue: null,
      createdAt: 1,
      updatedAt: 1,
    })).toBeNull();
  });
});
