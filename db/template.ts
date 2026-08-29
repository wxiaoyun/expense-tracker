import type * as SQLite from 'expo-sqlite'
import { and, eq, gt, isNotNull, isNull, ne, sql } from 'drizzle-orm'

import { createId } from '@/libs/id'
import { db, sqlite } from './index'
import { getDueOccurrenceDates, templateOccurrenceId } from './recurrence-core'
import { transactionTemplates, transactions, type TransactionTemplate } from './schema'
import {
  buildTemplateSuggestions,
  mapTemplateToTransaction,
  nextAvailableTemplateName,
  normalizeTemplateText,
  suggestionLookbackStart,
  validateTemplateDraft,
  type SuggestionLookback,
  type TemplateDraft,
} from './template-core'
import { createTransaction, listTemplateSuggestionRows, type Transaction } from './transaction'

export type TemplateListFilter = {
  search?: string
  type?: 'all' | 'manual' | 'scheduled'
  category?: string
  categories?: string[]
}

const info = (operation: string, stage: string, details: Record<string, unknown> = {}) => {
  console.info(`[templates.${operation}][stage=${stage}]`, details)
}

const failure = (operation: string, stage: string, error: unknown, details: Record<string, unknown> = {}) => {
  console.error(`[templates.${operation}][stage=${stage}] failed`, { ...details, error: String(error) })
}

const trimNullable = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? ''
  return trimmed || null
}

const normalizeDraft = (draft: TemplateDraft): TemplateDraft => {
  const recurrenceValue = trimNullable(draft.recurrenceValue)
  return {
    ...draft,
    name: draft.name.trim(),
    description: trimNullable(draft.description),
    category: trimNullable(draft.category),
    notes: trimNullable(draft.notes),
    recurrenceValue,
    startDate: recurrenceValue ? draft.startDate : null,
    scheduleCursorAt: recurrenceValue ? draft.scheduleCursorAt : null,
    scheduleActive: recurrenceValue ? draft.scheduleActive : false,
  }
}

const asDraft = (template: TransactionTemplate): TemplateDraft => ({
  name: template.name,
  amount: template.amount,
  transactionType: template.transactionType,
  description: template.description,
  category: template.category,
  notes: template.notes,
  verified: template.verified === null ? null : template.verified === 1,
  recurrenceValue: template.recurrenceValue,
  startDate: template.startDate,
  scheduleCursorAt: template.scheduleCursorAt,
  scheduleActive: template.scheduleActive === 1,
})

const assertValidDraft = (draft: TemplateDraft): void => {
  const validation = validateTemplateDraft(draft)
  if (!validation.ok) {
    throw new Error(validation.message)
  }
}

const activeNameExists = async (normalizedName: string, excludedId?: string): Promise<boolean> => {
  const idFilter = excludedId ? ne(transactionTemplates.id, excludedId) : undefined
  const row = await db
    .select({ id: transactionTemplates.id })
    .from(transactionTemplates)
    .where(and(
      eq(transactionTemplates.normalizedName, normalizedName),
      isNull(transactionTemplates.deletedAt),
      idFilter,
    ))
    .get()
  return Boolean(row)
}

const assertUniqueName = async (normalizedName: string, excludedId?: string): Promise<void> => {
  if (await activeNameExists(normalizedName, excludedId)) {
    throw new Error('Template name already exists')
  }
}

const isUniqueNameError = (error: unknown) =>
  String(error).includes('idx_templates_active_name') ||
  String(error).includes('transaction_templates.normalized_name')

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

const getBackfillDates = (draft: TemplateDraft, now: number): Date[] => {
  const normalized = normalizeDraft(draft)
  assertValidDraft(normalized)
  if (!normalized.recurrenceValue || normalized.startDate === null) {
    throw new Error('Backfill requires a scheduled template')
  }
  return getDueOccurrenceDates(
    normalized.recurrenceValue,
    new Date(normalized.startDate),
    new Date(now),
    deviceTimeZone(),
  )
}

const assertResumableTemplate = (template: TransactionTemplate): void => {
  const draft = asDraft(template)
  const recurrenceValue = draft.recurrenceValue?.trim() || null
  const normalizedDraft = { ...draft, recurrenceValue }
  if (
    normalizedDraft.amount === null ||
    !Number.isFinite(normalizedDraft.amount) ||
    normalizedDraft.amount <= 0 ||
    !normalizedDraft.description?.trim() ||
    !normalizedDraft.recurrenceValue ||
    normalizedDraft.startDate === null ||
    !Number.isFinite(normalizedDraft.startDate) ||
    normalizedDraft.scheduleCursorAt === null ||
    !Number.isFinite(normalizedDraft.scheduleCursorAt) ||
    !validateTemplateDraft(normalizedDraft).ok
  ) {
    throw new Error('Only complete scheduled templates can be resumed')
  }
}

const assertQuickAddComplete = (draft: TemplateDraft): void => {
  if (
    draft.amount === null ||
    !Number.isFinite(draft.amount) ||
    draft.amount <= 0 ||
    !(draft.description?.trim())
  ) {
    throw new Error('Quick Add requires a positive amount and description')
  }
}

const insertOccurrenceRows = async (
  transactionDb: Pick<SQLite.SQLiteDatabase, 'runAsync'>,
  template: TransactionTemplate,
  dates: Date[],
  timestamp: number,
): Promise<number> => {
  const values = mapTemplateToTransaction(asDraft(template), 0, template.id)
  let inserted = 0

  for (const date of dates) {
    const result = await transactionDb.runAsync(
      'INSERT OR IGNORE INTO transactions (id, amount, transaction_date, description, category, template_id, verified, notes, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)',
      templateOccurrenceId(template.id, date.getTime()),
      values.amount,
      date.getTime(),
      values.description,
      values.category,
      template.id,
      values.verified,
      values.notes,
      timestamp,
      timestamp,
    )
    inserted += result.changes
  }

  return inserted
}

const readTemplateInTransaction = async (
  transactionDb: Pick<SQLite.SQLiteDatabase, 'getFirstAsync'>,
  id: string,
): Promise<TransactionTemplate | null> => transactionDb.getFirstAsync<TransactionTemplate>(
  `SELECT
    id,
    name,
    normalized_name AS normalizedName,
    amount,
    transaction_type AS transactionType,
    description,
    category,
    notes,
    verified,
    recurrence_value AS recurrenceValue,
    start_date AS startDate,
    schedule_cursor_at AS scheduleCursorAt,
    schedule_active AS scheduleActive,
    deleted_at AS deletedAt,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM transaction_templates
  WHERE id = ?`,
  id,
)

type CompleteScheduledTemplate = TransactionTemplate & {
  amount: number
  description: string
  recurrenceValue: string
  startDate: number
  scheduleCursorAt: number
  scheduleActive: 1
  deletedAt: null
}

const assertCurrentScheduleSnapshot: (
  selected: TransactionTemplate,
  current: TransactionTemplate | null,
) => asserts current is CompleteScheduledTemplate = (selected, current) => {
  if (
    !current ||
    current.scheduleActive !== 1 ||
    current.deletedAt !== null ||
    current.amount === null ||
    !Number.isFinite(current.amount) ||
    current.amount <= 0 ||
    !current.description?.trim() ||
    !current.recurrenceValue ||
    current.startDate === null ||
    current.scheduleCursorAt === null
  ) {
    throw new Error('Scheduled template is no longer active and complete')
  }

  assertValidDraft(asDraft(current))
  if (
    current.recurrenceValue !== selected.recurrenceValue ||
    current.startDate !== selected.startDate ||
    current.scheduleCursorAt !== selected.scheduleCursorAt ||
    current.updatedAt !== selected.updatedAt
  ) {
    throw new Error('Scheduled template changed before processing')
  }
}

const advanceScheduleCursor = async (
  transactionDb: Pick<SQLite.SQLiteDatabase, 'runAsync'>,
  current: CompleteScheduledTemplate,
  nextCursorAt: number,
  timestamp: number,
): Promise<void> => {
  const cursorResult = await transactionDb.runAsync(
    `UPDATE transaction_templates
     SET schedule_cursor_at = ?, updated_at = ?
     WHERE id = ?
       AND schedule_active = 1
       AND deleted_at IS NULL
       AND amount IS NOT NULL
       AND amount > 0
       AND amount < 9e999
       AND description IS NOT NULL
       AND trim(description) <> ''
       AND recurrence_value = ?
       AND start_date = ?
       AND schedule_cursor_at = ?
       AND updated_at = ?`,
    nextCursorAt,
    timestamp,
    current.id,
    current.recurrenceValue,
    current.startDate,
    current.scheduleCursorAt,
    current.updatedAt,
  )
  if (cursorResult.changes !== 1) {
    throw new Error('Scheduled template changed while committing occurrences')
  }
}

const backfillTemplateInTransaction = async (
  transactionDb: Pick<SQLite.SQLiteDatabase, 'getFirstAsync' | 'runAsync'>,
  selected: TransactionTemplate,
  now: number,
): Promise<number> => {
  const current = await readTemplateInTransaction(transactionDb, selected.id)
  assertCurrentScheduleSnapshot(selected, current)

  const dates = getBackfillDates(asDraft(current), now)
  const inserted = await insertOccurrenceRows(transactionDb, current, dates, now)
  if (dates.length > 0) {
    await advanceScheduleCursor(transactionDb, current, dates[dates.length - 1].getTime(), now)
  }
  return inserted
}

const processScheduledTemplateInTransaction = async (
  transactionDb: Pick<SQLite.SQLiteDatabase, 'getFirstAsync' | 'runAsync'>,
  selected: TransactionTemplate,
  now: Date,
): Promise<number> => {
  const current = await readTemplateInTransaction(transactionDb, selected.id)
  assertCurrentScheduleSnapshot(selected, current)

  const dates = getDueOccurrenceDates(
    current.recurrenceValue,
    new Date(current.scheduleCursorAt),
    now,
    deviceTimeZone(),
  )
  const inserted = await insertOccurrenceRows(transactionDb, current, dates, now.getTime())
  if (dates.length > 0) {
    await advanceScheduleCursor(transactionDb, current, dates[dates.length - 1].getTime(), now.getTime())
  }
  return inserted
}

export async function getNextAvailableTemplateName(base: string, excludedId?: string): Promise<string> {
  info('next_available_name', 'query', { excludedId: excludedId ?? null })
  try {
    const rows = await db
      .select({ id: transactionTemplates.id, name: transactionTemplates.name })
      .from(transactionTemplates)
      .where(and(isNull(transactionTemplates.deletedAt), excludedId ? ne(transactionTemplates.id, excludedId) : undefined))
      .all()
    return nextAvailableTemplateName(base, rows.map((row) => row.name))
  } catch (error) {
    failure('next_available_name', 'query', error, { excludedId: excludedId ?? null })
    throw error
  }
}

export async function getTemplate(id: string): Promise<TransactionTemplate | null> {
  info('get', 'query', { id })
  try {
    return await db
      .select()
      .from(transactionTemplates)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .get() ?? null
  } catch (error) {
    failure('get', 'query', error, { id })
    throw error
  }
}

export async function listTemplates(filter: TemplateListFilter = {}): Promise<TransactionTemplate[]> {
  info('list', 'query', filter)
  try {
    const templateRows = await db
      .select()
      .from(transactionTemplates)
      .where(isNull(transactionTemplates.deletedAt))
      .all()
    const activeTransactions = await db
      .select({ templateId: transactions.templateId, transactionDate: transactions.transactionDate })
      .from(transactions)
      .where(isNull(transactions.deletedAt))
      .all()

    const latestUse = new Map<string, number>()
    for (const row of activeTransactions) {
      if (!row.templateId) continue
      latestUse.set(row.templateId, Math.max(latestUse.get(row.templateId) ?? 0, row.transactionDate))
    }

    const search = normalizeTemplateText(filter.search ?? '')
    const categories = filter.categories ?? (filter.category ? [filter.category] : [])
    return templateRows
      .filter((template) => {
        const scheduled = template.recurrenceValue !== null
        if (filter.type === 'scheduled' && !scheduled) return false
        if (filter.type === 'manual' && scheduled) return false
        if (categories.length > 0 && (!template.category || !categories.includes(template.category))) return false
        if (!search) return true
        return [template.name, template.description, template.category]
          .some((value) => value !== null && normalizeTemplateText(value).includes(search))
      })
      .sort((left, right) => {
        const leftUse = latestUse.get(left.id)
        const rightUse = latestUse.get(right.id)
        if (leftUse !== undefined || rightUse !== undefined) {
          if (leftUse === undefined) return 1
          if (rightUse === undefined) return -1
          if (rightUse !== leftUse) return rightUse - leftUse
        }
        if (right.updatedAt !== left.updatedAt) return right.updatedAt - left.updatedAt
        return normalizeTemplateText(left.name).localeCompare(normalizeTemplateText(right.name))
      })
  } catch (error) {
    failure('list', 'query', error, filter)
    throw error
  }
}

export async function createTemplate(draft: TemplateDraft, now = Date.now()): Promise<TransactionTemplate> {
  info('create', 'insert', { name: draft.name })
  try {
    const normalized = normalizeDraft(draft)
    assertValidDraft(normalized)
    const normalizedName = normalizeTemplateText(normalized.name)
    await assertUniqueName(normalizedName)
    const id = createId()
    const row: TransactionTemplate = {
      id,
      name: normalized.name,
      normalizedName,
      amount: normalized.amount,
      transactionType: normalized.transactionType,
      description: normalized.description,
      category: normalized.category,
      notes: normalized.notes,
      verified: normalized.verified === null ? null : normalized.verified ? 1 : 0,
      recurrenceValue: normalized.recurrenceValue,
      startDate: normalized.startDate,
      scheduleCursorAt: normalized.recurrenceValue ? normalized.startDate : null,
      scheduleActive: normalized.recurrenceValue && normalized.scheduleActive ? 1 : 0,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(transactionTemplates).values(row).run()
    return row
  } catch (error) {
    const normalizedError = isUniqueNameError(error) ? new Error('Template name already exists') : error
    failure('create', 'insert', normalizedError, { name: draft.name })
    throw normalizedError
  }
}

export async function updateTemplate(
  id: string,
  draft: TemplateDraft,
  now = Date.now(),
): Promise<TransactionTemplate | null> {
  info('update', 'update', { id, name: draft.name })
  try {
    const normalized = normalizeDraft(draft)
    assertValidDraft(normalized)
    const existing = await db
      .select()
      .from(transactionTemplates)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .get()
    if (!existing) return null

    const normalizedName = normalizeTemplateText(normalized.name)
    await assertUniqueName(normalizedName, id)
    const scheduleDefinitionChanged = sql`
      ${transactionTemplates.recurrenceValue} IS NOT ${normalized.recurrenceValue}
      OR ${transactionTemplates.startDate} IS NOT ${normalized.startDate}
    `
    // Evaluate activation against the row at UPDATE time so an inactive-to-active edit cannot retain a stale cursor.
    const scheduleCursorAt = normalized.recurrenceValue
      ? normalized.scheduleActive
        ? sql<number | null>`CASE
            WHEN ${scheduleDefinitionChanged} OR ${transactionTemplates.scheduleActive} = 0 THEN ${now}
            ELSE ${transactionTemplates.scheduleCursorAt}
          END`
        : sql<number | null>`CASE
            WHEN ${scheduleDefinitionChanged} THEN ${now}
            ELSE ${transactionTemplates.scheduleCursorAt}
          END`
      : null
    const set = {
      name: normalized.name,
      normalizedName,
      amount: normalized.amount,
      transactionType: normalized.transactionType,
      description: normalized.description,
      category: normalized.category,
      notes: normalized.notes,
      verified: normalized.verified === null ? null : normalized.verified ? 1 : 0,
      recurrenceValue: normalized.recurrenceValue,
      startDate: normalized.startDate,
      scheduleCursorAt,
      scheduleActive: normalized.recurrenceValue && normalized.scheduleActive ? 1 : 0,
      updatedAt: now,
    }
    const result = await db
      .update(transactionTemplates)
      .set(set)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .run()
    if (result.changes !== 1) return null
    return await db
      .select()
      .from(transactionTemplates)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .get() ?? null
  } catch (error) {
    const normalizedError = isUniqueNameError(error) ? new Error('Template name already exists') : error
    failure('update', 'update', normalizedError, { id, name: draft.name })
    throw normalizedError
  }
}

export async function softDeleteTemplate(id: string, now = Date.now()): Promise<boolean> {
  info('delete', 'soft_delete', { id, now })
  try {
    const result = await db
      .update(transactionTemplates)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .run()
    return result.changes > 0
  } catch (error) {
    failure('delete', 'soft_delete', error, { id, now })
    throw error
  }
}

export async function pauseTemplate(id: string, now = Date.now()): Promise<TransactionTemplate | null> {
  info('pause', 'update', { id, now })
  try {
    const existing = await db
      .select()
      .from(transactionTemplates)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .get()
    if (!existing) return null
    const result = await db
      .update(transactionTemplates)
      .set({ scheduleActive: 0 })
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .run()
    return result.changes === 1 ? { ...existing, scheduleActive: 0 } : null
  } catch (error) {
    failure('pause', 'update', error, { id, now })
    throw error
  }
}

export async function resumeTemplate(id: string, now = Date.now()): Promise<TransactionTemplate | null> {
  info('resume', 'update', { id, now })
  try {
    const existing = await db
      .select()
      .from(transactionTemplates)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .get()
    if (!existing) return null
    assertResumableTemplate(existing)
    const set = { scheduleActive: 1, scheduleCursorAt: now, updatedAt: now }
    const result = await db
      .update(transactionTemplates)
      .set(set)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .run()
    return result.changes === 1 ? { ...existing, ...set } : null
  } catch (error) {
    failure('resume', 'update', error, { id, now })
    throw error
  }
}

export async function convertTemplateToManual(id: string, now = Date.now()): Promise<TransactionTemplate | null> {
  info('convert_to_manual', 'update', { id, now })
  try {
    const existing = await db
      .select()
      .from(transactionTemplates)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .get()
    if (!existing) return null
    const set = {
      recurrenceValue: null,
      startDate: null,
      scheduleCursorAt: null,
      scheduleActive: 0,
      updatedAt: now,
    }
    const result = await db
      .update(transactionTemplates)
      .set(set)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .run()
    return result.changes === 1 ? { ...existing, ...set } : null
  } catch (error) {
    failure('convert_to_manual', 'update', error, { id, now })
    throw error
  }
}

export async function quickAddTemplate(id: string, now = Date.now()): Promise<Transaction> {
  info('quick_add', 'insert_transaction', { id, now })
  try {
    const template = await db
      .select()
      .from(transactionTemplates)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .get()
    if (!template) throw new Error('Template not found')
    const draft = asDraft(template)
    assertQuickAddComplete(draft)
    const transaction = await createTransaction(mapTemplateToTransaction(draft, now, id))
    if (!transaction) throw new Error('Quick Add transaction was not created')
    return transaction
  } catch (error) {
    failure('quick_add', 'insert_transaction', error, { id, now })
    throw error
  }
}

export async function previewTemplateBackfill(draft: TemplateDraft, now = Date.now()): Promise<number> {
  info('preview_backfill', 'calculate', { name: draft.name, now })
  try {
    return getBackfillDates(draft, now).length
  } catch (error) {
    failure('preview_backfill', 'calculate', error, { name: draft.name, now })
    throw error
  }
}

export async function backfillTemplate(id: string, now = Date.now()): Promise<number> {
  info('backfill', 'commit_occurrences', { id, now })
  try {
    const template = await db
      .select()
      .from(transactionTemplates)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .get()
    if (!template) throw new Error('Template not found')
    let inserted = 0
    await sqlite.withExclusiveTransactionAsync(async (transactionDb) => {
      inserted = await backfillTemplateInTransaction(transactionDb, template, now)
    })
    return inserted
  } catch (error) {
    failure('backfill', 'commit_occurrences', error, { id, now })
    throw error
  }
}

export async function processScheduledTemplates(
  now = new Date(),
): Promise<Array<{ id: string, incurred: number | null }>> {
  info('process_scheduled', 'query', { now: now.getTime() })
  try {
    const scheduled = await db
      .select()
      .from(transactionTemplates)
      .where(and(
        eq(transactionTemplates.scheduleActive, 1),
        isNull(transactionTemplates.deletedAt),
        isNotNull(transactionTemplates.amount),
        gt(transactionTemplates.amount, 0),
        sql`${transactionTemplates.amount} < 9e999`,
        isNotNull(transactionTemplates.description),
        sql`trim(${transactionTemplates.description}) <> ''`,
        isNotNull(transactionTemplates.recurrenceValue),
        isNotNull(transactionTemplates.startDate),
        isNotNull(transactionTemplates.scheduleCursorAt),
      ))
      .all()
    const results: Array<{ id: string, incurred: number | null }> = []

    for (const template of scheduled) {
      try {
        let inserted = 0
        await sqlite.withExclusiveTransactionAsync(async (transactionDb) => {
          inserted = await processScheduledTemplateInTransaction(transactionDb, template, now)
        })
        results.push({ id: template.id, incurred: inserted })
      } catch (error) {
        failure('process_scheduled', 'process_template', error, {
          id: template.id,
          recurrenceValue: template.recurrenceValue,
        })
        results.push({ id: template.id, incurred: null })
      }
    }

    return results
  } catch (error) {
    failure('process_scheduled', 'query', error, { now: now.getTime() })
    throw error
  }
}

export async function listHistoricalTemplateSuggestions(
  lookback: SuggestionLookback,
  now = Date.now(),
) {
  info('historical_suggestions', 'query', { lookback, now })
  try {
    const startDate = suggestionLookbackStart(lookback, now)
    const [rows, activeTemplates] = await Promise.all([
      listTemplateSuggestionRows(startDate),
      db
        .select()
        .from(transactionTemplates)
        .where(isNull(transactionTemplates.deletedAt))
        .all(),
    ])
    return buildTemplateSuggestions(rows, activeTemplates.map(asDraft))
  } catch (error) {
    failure('historical_suggestions', 'query', error, { lookback, now })
    throw error
  }
}
