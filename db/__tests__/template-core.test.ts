import {
  buildTemplateSuggestions,
  getTransactionInitialFocus,
  mapTemplateToTransaction,
  nextAvailableTemplateName,
  normalizeTemplateText,
  validateTemplateDraft,
  type TemplateDraft,
} from '../template-core'

const draft = (overrides: Partial<TemplateDraft> = {}): TemplateDraft => ({
  name: 'Coffee',
  amount: null,
  transactionType: null,
  description: null,
  category: null,
  notes: null,
  verified: null,
  recurrenceValue: null,
  startDate: null,
  scheduleCursorAt: null,
  scheduleActive: false,
  ...overrides,
})

describe('template core', () => {
  it('normalizes names without changing display text', () => {
    expect(normalizeTemplateText(' Weekly   Groceries ')).toBe('weekly groceries')
  })

  it('requires a template name', () => {
    expect(validateTemplateDraft(draft({ name: ' ' }))).toEqual({
      ok: false,
      field: 'name',
      message: 'Template name is required',
    })
  })

  it('requires one reusable field and validates scheduled templates on submit', () => {
    expect(validateTemplateDraft(draft({ name: 'Empty' }))).toEqual({
      ok: false,
      field: 'amount',
      message: 'Add at least one reusable transaction field',
    })
    expect(validateTemplateDraft(draft({ amount: 0 }))).toEqual({
      ok: false,
      field: 'amount',
      message: 'Amount must be greater than zero',
    })
    expect(validateTemplateDraft(draft({ recurrenceValue: '0 0 1 * *', startDate: 1 }))).toEqual({
      ok: false,
      field: 'amount',
      message: 'Scheduled templates require an amount',
    })
  })

  it('rejects non-finite and non-positive amounts even when another reusable field exists', () => {
    expect(validateTemplateDraft(draft({ description: 'Lunch', amount: NaN }))).toEqual({
      ok: false,
      field: 'amount',
      message: 'Amount must be greater than zero',
    })
    expect(validateTemplateDraft(draft({ category: 'Food', amount: Infinity }))).toEqual({
      ok: false,
      field: 'amount',
      message: 'Amount must be greater than zero',
    })
  })

  it('counts transaction type as a reusable field', () => {
    expect(validateTemplateDraft(draft({ transactionType: 'income' }))).toEqual({ ok: true })
  })

  it('accepts unscheduled drafts with non-amount reusable fields', () => {
    expect(validateTemplateDraft(draft({ description: 'Lunch' }))).toEqual({ ok: true })
    expect(validateTemplateDraft(draft({ category: 'Food' }))).toEqual({ ok: true })
  })

  it('maps omitted values to transaction defaults and signs income', () => {
    expect(mapTemplateToTransaction(
      draft({ amount: 12.5, transactionType: 'income', description: 'Refund' }),
      123,
      'template-1',
    )).toEqual({
      amount: 12.5,
      transactionDate: 123,
      description: 'Refund',
      category: 'Other',
      notes: null,
      verified: 0,
      templateId: 'template-1',
      deletedAt: null,
    })
  })

  it('groups three untemplated rows and chooses modal amount with recent tie breaking', () => {
    const rows = [
      { amount: -4, transactionDate: 1, description: ' Coffee ', category: 'Food' },
      { amount: -5, transactionDate: 2, description: 'coffee', category: 'food' },
      { amount: -4, transactionDate: 3, description: 'COFFEE', category: 'Food' },
    ]
    expect(buildTemplateSuggestions(rows, [])).toEqual([
      expect.objectContaining({ name: 'COFFEE', amount: 4, transactionType: 'expense', count: 3 }),
    ])
  })

  it('filters out suggestion groups smaller than three rows', () => {
    const rows = [
      { amount: -3, transactionDate: 1, description: 'Tea', category: 'Drinks' },
      { amount: -3, transactionDate: 2, description: 'Tea', category: 'Drinks' },
      { amount: -7, transactionDate: 3, description: 'Snacks', category: 'Food' },
      { amount: -7, transactionDate: 4, description: 'Snacks', category: 'Food' },
      { amount: -7, transactionDate: 5, description: 'Snacks', category: 'Food' },
    ]
    expect(buildTemplateSuggestions(rows, [])).toEqual([
      expect.objectContaining({ name: 'Snacks', amount: 7, transactionType: 'expense', count: 3 }),
    ])
  })

  it('suppresses active-template duplicates using default category and type', () => {
    const rows = [
      { amount: -4, transactionDate: 1, description: 'Coffee', category: 'Other' },
      { amount: -4, transactionDate: 2, description: 'Coffee', category: 'Other' },
      { amount: -4, transactionDate: 3, description: 'Coffee', category: 'Other' },
    ]
    expect(buildTemplateSuggestions(rows, [draft({ description: 'Coffee' })])).toEqual([])
  })

  it('suppresses Coffee/Other/expense when the active template only has a name', () => {
    const rows = [
      { amount: -4, transactionDate: 1, description: 'Coffee', category: 'Other' },
      { amount: -4, transactionDate: 2, description: 'Coffee', category: 'Other' },
      { amount: -4, transactionDate: 3, description: 'Coffee', category: 'Other' },
    ]
    expect(buildTemplateSuggestions(rows, [draft()])).toEqual([])
  })

  it('suggests a suffix and chooses focus from creation context', () => {
    expect(nextAvailableTemplateName('Coffee', ['coffee', 'Coffee 2'])).toBe('Coffee 3')
    expect(getTransactionInitialFocus({ isEdit: false, fromTemplate: false, amount: '', description: '' })).toBe('amount')
    expect(getTransactionInitialFocus({ isEdit: false, fromTemplate: true, amount: '5', description: '' })).toBe('description')
    expect(getTransactionInitialFocus({ isEdit: false, fromTemplate: true, amount: '5', description: 'Coffee' })).toBeNull()
  })
})
