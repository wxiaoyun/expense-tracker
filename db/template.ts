import type * as SQLite from 'expo-sqlite'
import { and, eq, gt, isNotNull, isNull, ne, sql } from 'drizzle-orm'

import { createId } from '@/libs/id'
import { db, sqlite } from './index'
import { getDueOccurrenceDates, templateOccurrenceId } from './recurrence-core'
import {
  categories as categoryPresets,
  transactionTemplates,
  transactions,
  type TransactionTemplate,
} from './schema'
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

const safeFilterDetails = (filter: TemplateListFilter) => ({
  has_search: Boolean(filter.search?.trim()),
  type: filter.type ?? 'all',
  category_count: filter.categories?.length ?? (filter.category ? 1 : 0),
})

const safeDraftDetails = (draft: TemplateDraft) => ({
  is_scheduled: Boolean(draft.recurrenceValue?.trim()),
  schedule_active: Boolean(draft.recurrenceValue?.trim()) && draft.scheduleActive,
  has_amount: draft.amount !== null,
  has_description: Boolean(draft.description?.trim()),
})

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
    template.deletedAt !== null ||
    template.scheduleActive !== 0 ||
    normalizedDraft.amount === null ||
    !Number.isFinite(normalizedDraft.amount) ||
    normalizedDraft.amount <= 0 ||
    !normalizedDraft.description?.trim() ||
    !normalizedDraft.recurrenceValue ||
    normalizedDraft.startDate === null ||
    !Number.isFinite(normalizedDraft.startDate) ||
    !Number.isInteger(normalizedDraft.startDate) ||
    normalizedDraft.scheduleCursorAt === null ||
    !Number.isFinite(normalizedDraft.scheduleCursorAt) ||
    !Number.isInteger(normalizedDraft.scheduleCursorAt) ||
    normalizedDraft.scheduleCursorAt < normalizedDraft.startDate ||
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
  scheduleActive: 0 | 1
  deletedAt: null
}

const assertCurrentScheduleSnapshot: (
  selected: TransactionTemplate,
  current: TransactionTemplate | null,
  requireActive: boolean,
) => asserts current is CompleteScheduledTemplate = (selected, current, requireActive) => {
  if (
    !current ||
    current.deletedAt !== null ||
    (current.scheduleActive !== 0 && current.scheduleActive !== 1) ||
    (requireActive && current.scheduleActive !== 1) ||
    current.amount === null ||
    !Number.isFinite(current.amount) ||
    current.amount <= 0 ||
    !current.description?.trim() ||
    !current.recurrenceValue?.trim() ||
    current.startDate === null ||
    !Number.isFinite(current.startDate) ||
    !Number.isInteger(current.startDate) ||
    current.scheduleCursorAt === null ||
    !Number.isFinite(current.scheduleCursorAt) ||
    !Number.isInteger(current.scheduleCursorAt) ||
    current.scheduleCursorAt < current.startDate
  ) {
    throw new Error('Scheduled template is no longer complete')
  }

  assertValidDraft(asDraft(current))
  if (
    current.amount !== selected.amount ||
    current.transactionType !== selected.transactionType ||
    current.description !== selected.description ||
    current.category !== selected.category ||
    current.notes !== selected.notes ||
    current.verified !== selected.verified ||
    current.recurrenceValue !== selected.recurrenceValue ||
    current.startDate !== selected.startDate ||
    current.scheduleCursorAt !== selected.scheduleCursorAt ||
    current.scheduleActive !== selected.scheduleActive ||
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
       AND schedule_active = ?
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
    current.scheduleActive,
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
  assertCurrentScheduleSnapshot(selected, current, false)

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
  assertCurrentScheduleSnapshot(selected, current, true)

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

export async function listTemplateCategories(): Promise<string[]> {
  info('list_categories', 'query')
  try {
    const rows = await db.all<{ category: string }>(sql`
      SELECT category
      FROM (
        SELECT category AS category
        FROM ${transactionTemplates}
        WHERE ${transactionTemplates.deletedAt} IS NULL
          AND category IS NOT NULL
          AND trim(category) <> ''
        UNION ALL
        SELECT category AS category
        FROM ${transactions}
        WHERE ${transactions.deletedAt} IS NULL
          AND trim(category) <> ''
        UNION ALL
        SELECT name AS category
        FROM ${categoryPresets}
        WHERE ${categoryPresets.is_preset} = 1
          AND trim(name) <> ''
      )
      ORDER BY category COLLATE NOCASE, category
    `)
    const seen = new Set<string>()
    return rows.flatMap(({ category }) => {
      const normalized = normalizeTemplateText(category)
      if (!normalized || seen.has(normalized)) return []
      seen.add(normalized)
      return [category]
    })
  } catch (error) {
    failure('list_categories', 'query', error)
    throw error
  }
}

export async function listTemplates(filter: TemplateListFilter = {}): Promise<TransactionTemplate[]> {
  const filterDetails = safeFilterDetails(filter)
  info('list', 'query', filterDetails)
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
    const normalizedCategories = categories.map(normalizeTemplateText)
    return templateRows
      .filter((template) => {
        const scheduled = template.recurrenceValue !== null
        if (filter.type === 'scheduled' && !scheduled) return false
        if (filter.type === 'manual' && scheduled) return false
        if (normalizedCategories.length > 0 && (!template.category || !normalizedCategories.includes(normalizeTemplateText(template.category)))) return false
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
        if (right.createdAt !== left.createdAt) return right.createdAt - left.createdAt
        return normalizeTemplateText(left.name).localeCompare(normalizeTemplateText(right.name))
      })
  } catch (error) {
    failure('list', 'query', error, filterDetails)
    throw error
  }
}

export async function createTemplate(draft: TemplateDraft, now = Date.now()): Promise<TransactionTemplate> {
  const draftDetails = safeDraftDetails(draft)
  info('create', 'insert', draftDetails)
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
    failure('create', 'insert', normalizedError, draftDetails)
    throw normalizedError
  }
}

export async function updateTemplate(
  id: string,
  draft: TemplateDraft,
  now = Date.now(),
): Promise<TransactionTemplate | null> {
  const draftDetails = { id, ...safeDraftDetails(draft) }
  info('update', 'update', draftDetails)
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
    const scheduleFloor = normalized.startDate === null
      ? now
      : Math.max(now, normalized.startDate)
    const scheduleCursorAt = normalized.recurrenceValue
      ? normalized.scheduleActive
        ? sql<number | null>`CASE
            WHEN ${scheduleDefinitionChanged} THEN ${scheduleFloor}
            WHEN ${transactionTemplates.scheduleActive} = 0 THEN max(
              ${scheduleFloor},
              coalesce(${transactionTemplates.scheduleCursorAt}, ${scheduleFloor})
            )
            ELSE ${transactionTemplates.scheduleCursorAt}
          END`
        : sql<number | null>`CASE
            WHEN ${scheduleDefinitionChanged} THEN ${scheduleFloor}
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
    const snapshotGuard = sql`
      ${transactionTemplates.name} IS ${existing.name}
      AND ${transactionTemplates.normalizedName} IS ${existing.normalizedName}
      AND ${transactionTemplates.amount} IS ${existing.amount}
      AND ${transactionTemplates.transactionType} IS ${existing.transactionType}
      AND ${transactionTemplates.description} IS ${existing.description}
      AND ${transactionTemplates.category} IS ${existing.category}
      AND ${transactionTemplates.notes} IS ${existing.notes}
      AND ${transactionTemplates.verified} IS ${existing.verified}
      AND ${transactionTemplates.recurrenceValue} IS ${existing.recurrenceValue}
      AND ${transactionTemplates.startDate} IS ${existing.startDate}
      AND ${transactionTemplates.scheduleCursorAt} IS ${existing.scheduleCursorAt}
      AND ${transactionTemplates.scheduleActive} IS ${existing.scheduleActive}
      AND ${transactionTemplates.updatedAt} IS ${existing.updatedAt}
    `
    const result = await db
      .update(transactionTemplates)
      .set(set)
      .where(and(
        eq(transactionTemplates.id, id),
        isNull(transactionTemplates.deletedAt),
        snapshotGuard,
      ))
      .run()
    if (result.changes !== 1) return null
    return await db
      .select()
      .from(transactionTemplates)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .get() ?? null
  } catch (error) {
    const normalizedError = isUniqueNameError(error) ? new Error('Template name already exists') : error
    failure('update', 'update', normalizedError, draftDetails)
    throw normalizedError
  }
}

export async function softDeleteTemplate(id: string, now = Date.now()): Promise<boolean> {
  info('delete', 'soft_delete', { id })
  try {
    const result = await db
      .update(transactionTemplates)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .run()
    return result.changes > 0
  } catch (error) {
    failure('delete', 'soft_delete', error, { id })
    throw error
  }
}

export async function pauseTemplate(id: string, now = Date.now()): Promise<TransactionTemplate | null> {
  info('pause', 'update', { id })
  try {
    const existing = await db
      .select()
      .from(transactionTemplates)
      .where(and(eq(transactionTemplates.id, id), isNull(transactionTemplates.deletedAt)))
      .get()
    if (!existing) return null
    const set = { scheduleActive: 0, updatedAt: now }
    const result = await db
      .update(transactionTemplates)
      .set(set)
      .where(and(
        eq(transactionTemplates.id, id),
        isNull(transactionTemplates.deletedAt),
        sql`${transactionTemplates.scheduleActive} IS ${existing.scheduleActive}`,
        sql`${transactionTemplates.updatedAt} IS ${existing.updatedAt}`,
      ))
      .run()
    return result.changes === 1 ? { ...existing, ...set } : null
  } catch (error) {
    failure('pause', 'update', error, { id })
    throw error
  }
}

export async function resumeTemplate(id: string, now = Date.now()): Promise<TransactionTemplate | null> {
  info('resume', 'update', { id })
  try {
    let resumed: TransactionTemplate | null = null
    await sqlite.withExclusiveTransactionAsync(async (transactionDb) => {
      const current = await readTemplateInTransaction(transactionDb, id)
      if (!current || current.deletedAt !== null) return
      assertResumableTemplate(current)

      const nextCursorAt = Math.max(now, current.startDate!, current.scheduleCursorAt!)
      const result = await transactionDb.runAsync(
        `UPDATE transaction_templates
         SET schedule_active = 1, schedule_cursor_at = ?, updated_at = ?
         WHERE id = ?
           AND deleted_at IS NULL
           AND schedule_active = 0
           AND amount IS ?
           AND transaction_type IS ?
           AND description IS ?
           AND category IS ?
           AND notes IS ?
           AND verified IS ?
           AND recurrence_value IS ?
           AND start_date IS ?
           AND schedule_cursor_at IS ?
           AND updated_at IS ?`,
        nextCursorAt,
        now,
        current.id,
        current.amount,
        current.transactionType,
        current.description,
        current.category,
        current.notes,
        current.verified,
        current.recurrenceValue,
        current.startDate,
        current.scheduleCursorAt,
        current.updatedAt,
      )
      if (result.changes !== 1) {
        throw new Error('Scheduled template changed while resuming')
      }
      resumed = {
        ...current,
        scheduleActive: 1,
        scheduleCursorAt: nextCursorAt,
        updatedAt: now,
      }
    })
    return resumed
  } catch (error) {
    failure('resume', 'update', error, { id })
    throw error
  }
}

export async function convertTemplateToManual(id: string, now = Date.now()): Promise<TransactionTemplate | null> {
  info('convert_to_manual', 'update', { id })
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
      .where(and(
        eq(transactionTemplates.id, id),
        isNull(transactionTemplates.deletedAt),
        sql`${transactionTemplates.recurrenceValue} IS ${existing.recurrenceValue}`,
        sql`${transactionTemplates.startDate} IS ${existing.startDate}`,
        sql`${transactionTemplates.scheduleCursorAt} IS ${existing.scheduleCursorAt}`,
        sql`${transactionTemplates.scheduleActive} IS ${existing.scheduleActive}`,
        sql`${transactionTemplates.updatedAt} IS ${existing.updatedAt}`,
      ))
      .run()
    return result.changes === 1 ? { ...existing, ...set } : null
  } catch (error) {
    failure('convert_to_manual', 'update', error, { id })
    throw error
  }
}

export async function quickAddTemplate(id: string, now = Date.now()): Promise<Transaction> {
  info('quick_add', 'insert_transaction', { id })
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
    failure('quick_add', 'insert_transaction', error, { id })
    throw error
  }
}

export async function previewTemplateBackfill(draft: TemplateDraft, now = Date.now()): Promise<number> {
  const draftDetails = safeDraftDetails(draft)
  info('preview_backfill', 'calculate', draftDetails)
  try {
    return getBackfillDates(draft, now).length
  } catch (error) {
    failure('preview_backfill', 'calculate', error, draftDetails)
    throw error
  }
}

export async function backfillTemplate(id: string, now = Date.now()): Promise<number> {
  info('backfill', 'commit_occurrences', { id })
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
    failure('backfill', 'commit_occurrences', error, { id })
    throw error
  }
}

export async function processScheduledTemplates(
  now = new Date(),
): Promise<Array<{ id: string, incurred: number | null }>> {
  info('process_scheduled', 'query')
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
        sql`typeof(${transactionTemplates.startDate}) = 'integer'`,
        sql`typeof(${transactionTemplates.scheduleCursorAt}) = 'integer'`,
        sql`${transactionTemplates.scheduleCursorAt} >= ${transactionTemplates.startDate}`,
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
        failure('process_scheduled', 'process_template', error, { id: template.id })
        results.push({ id: template.id, incurred: null })
      }
    }

    return results
  } catch (error) {
    failure('process_scheduled', 'query', error)
    throw error
  }
}

export async function listHistoricalTemplateSuggestions(
  lookback: SuggestionLookback,
  now = Date.now(),
) {
  info('historical_suggestions', 'query', { lookback })
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
    failure('historical_suggestions', 'query', error, { lookback })
    throw error
  }
}
