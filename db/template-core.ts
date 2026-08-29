import { subMonths } from 'date-fns'

import { validateOccurrence } from '../libs/date'

export type TransactionType = 'income' | 'expense'
export type SuggestionLookback = '1m' | '3m' | '6m' | '12m' | 'all'

export const suggestionLookbackStart = (value: SuggestionLookback, now: number): number => {
  if (value === 'all') return 0

  const months = Number(value.slice(0, -1))
  return subMonths(new Date(now), months).getTime()
}

export type TemplateDraft = {
  name: string
  amount: number | null
  transactionType: TransactionType | null
  description: string | null
  category: string | null
  notes: string | null
  verified: boolean | null
  recurrenceValue: string | null
  startDate: number | null
  scheduleCursorAt: number | null
  scheduleActive: boolean
}

export type HistoricalTransactionInput = {
  amount: number
  transactionDate: number
  description: string
  category: string
}

export type TemplateSuggestion = TemplateDraft & {
  count: number
  mostRecentAt: number
}

export type TemplateValidationResult =
  | { ok: true }
  | { ok: false; field: 'name' | 'amount' | 'description' | 'recurrenceValue' | 'startDate'; message: string }

export type TemplateTransactionValues = {
  amount: number
  transactionDate: number
  description: string
  category: string
  notes: string | null
  verified: number
  templateId: string
  deletedAt: number | null
}

export const normalizeTemplateText = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()

const trimText = (value: string | null | undefined) => value?.trim() ?? ''

const getTransactionType = (transactionType: TransactionType | null): TransactionType =>
  transactionType ?? 'expense'

const getSignedAmount = (amount: number, transactionType: TransactionType | null): number => {
  const magnitude = Math.abs(amount)
  return getTransactionType(transactionType) === 'income' ? magnitude : -magnitude
}

const isReusableAmountMissing = (amount: number | null) => amount == null

const isReusableAmountInvalid = (amount: number | null) => amount !== null && (!Number.isFinite(amount) || amount <= 0)

const hasReusableTemplateField = (draft: TemplateDraft) =>
  !isReusableAmountMissing(draft.amount) ||
  Boolean(trimText(draft.description)) ||
  Boolean(trimText(draft.category)) ||
  Boolean(trimText(draft.notes)) ||
  draft.verified !== null ||
  draft.transactionType !== null

export const validateTemplateDraft = (draft: TemplateDraft): TemplateValidationResult => {
  const recurrenceValue = trimText(draft.recurrenceValue)
  const amount = draft.amount
  const name = trimText(draft.name)
  const description = trimText(draft.description)
  const startDate = draft.startDate

  if (!name) {
    return {
      ok: false,
      field: 'name',
      message: 'Template name is required',
    }
  }

  if (isReusableAmountInvalid(amount)) {
    return {
      ok: false,
      field: 'amount',
      message: 'Amount must be greater than zero',
    }
  }

  if (recurrenceValue) {
    if (isReusableAmountMissing(amount)) {
      return {
        ok: false,
        field: 'amount',
        message: 'Scheduled templates require an amount',
      }
    }

    if (!description) {
      return {
        ok: false,
        field: 'description',
        message: 'Description is required',
      }
    }

    const validation = validateOccurrence(recurrenceValue)
    if (!validation.ok) {
      return {
        ok: false,
        field: 'recurrenceValue',
        message: 'Invalid cron expression',
      }
    }

    if (startDate == null) {
      return {
        ok: false,
        field: 'startDate',
        message: 'Start date is required',
      }
    }

    if (!Number.isFinite(startDate) || !Number.isInteger(startDate)) {
      return {
        ok: false,
        field: 'startDate',
        message: 'Start date is invalid',
      }
    }

    return { ok: true }
  }

  if (!hasReusableTemplateField(draft)) {
    return {
      ok: false,
      field: 'amount',
      message: 'Add at least one reusable transaction field',
    }
  }

  return { ok: true }
}

export const mapTemplateToTransaction = (
  draft: TemplateDraft,
  transactionDate: number,
  templateId: string,
): TemplateTransactionValues => {
  const amount = typeof draft.amount === 'number' && Number.isFinite(draft.amount) ? draft.amount : 0
  const category = trimText(draft.category) || 'Other'
  const description = trimText(draft.description) || trimText(draft.name)

  return {
    amount: getSignedAmount(amount, draft.transactionType),
    transactionDate,
    description,
    category,
    notes: trimText(draft.notes) || null,
    verified: draft.verified ? 1 : 0,
    templateId,
    deletedAt: null,
  }
}

type SuggestionGroup = {
  key: string
  name: string
  description: string
  category: string
  transactionType: TransactionType
  amountCounts: Map<number, { count: number; mostRecentAt: number }>
  count: number
  mostRecentAt: number
}

const buildKey = (description: string, category: string, transactionType: TransactionType) =>
  [normalizeTemplateText(description), normalizeTemplateText(category), transactionType].join('|')

const buildActiveTemplateKey = (template: TemplateDraft) => {
  const description = trimText(template.description) || trimText(template.name)
  if (!description) return null
  return buildKey(description, trimText(template.category) || 'Other', template.transactionType ?? 'expense')
}

const parseSeries = (value: string) => {
  const trimmed = value.trim()
  const match = trimmed.match(/^(.*?)(?:\s+(\d+))?$/)
  const stem = (match?.[1] ?? trimmed).trim()
  const suffix = match?.[2] ? Number(match[2]) : null
  return { stem, suffix, trimmed }
}

export const buildTemplateSuggestions = (
  rows: HistoricalTransactionInput[],
  activeTemplates: TemplateDraft[],
): TemplateSuggestion[] => {
  const activeKeys = new Set(
    activeTemplates
      .map(buildActiveTemplateKey)
      .filter((key): key is string => key !== null),
  )

  const groups = new Map<string, SuggestionGroup>()

  for (const row of rows) {
    if (!Number.isFinite(row.amount)) continue
    const transactionType: TransactionType = row.amount >= 0 ? 'income' : 'expense'
    const key = buildKey(row.description, row.category, transactionType)

    if (activeKeys.has(key)) {
      continue
    }

    const current = groups.get(key) ?? {
      key,
      name: row.description.trim(),
      description: row.description.trim(),
      category: row.category.trim(),
      transactionType,
      amountCounts: new Map<number, { count: number; mostRecentAt: number }>(),
      count: 0,
      mostRecentAt: row.transactionDate,
    }

    current.count += 1
    current.mostRecentAt = Math.max(current.mostRecentAt, row.transactionDate)
    if (row.transactionDate >= current.mostRecentAt) {
      current.name = row.description.trim()
      current.description = row.description.trim()
      current.category = row.category.trim()
    }

    const amount = Math.abs(row.amount)
    const amountStats = current.amountCounts.get(amount) ?? { count: 0, mostRecentAt: 0 }
    amountStats.count += 1
    amountStats.mostRecentAt = Math.max(amountStats.mostRecentAt, row.transactionDate)
    current.amountCounts.set(amount, amountStats)

    groups.set(key, current)
  }

  const eligibleGroups = [...groups.values()].filter((group) => group.count >= 3)

  const suggestions = eligibleGroups.map<TemplateSuggestion>((group) => {
    let selectedAmount = 0
    let selectedStats: { count: number; mostRecentAt: number } | null = null

    for (const [amount, stats] of group.amountCounts) {
      if (
        !selectedStats ||
        stats.count > selectedStats.count ||
        (stats.count === selectedStats.count && stats.mostRecentAt > selectedStats.mostRecentAt) ||
        (stats.count === selectedStats.count && stats.mostRecentAt === selectedStats.mostRecentAt && amount < selectedAmount)
      ) {
        selectedAmount = amount
        selectedStats = stats
      }
    }

    return {
      name: group.name,
      amount: selectedAmount,
      transactionType: group.transactionType,
      description: group.description,
      category: group.category,
      notes: null,
      verified: null,
      recurrenceValue: null,
      startDate: null,
      scheduleCursorAt: null,
      scheduleActive: false,
      count: group.count,
      mostRecentAt: group.mostRecentAt,
    }
  })

  return suggestions
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count
      if (right.mostRecentAt !== left.mostRecentAt) return right.mostRecentAt - left.mostRecentAt
      return normalizeTemplateText(left.name).localeCompare(normalizeTemplateText(right.name))
    })
    .slice(0, 5)
}

export const nextAvailableTemplateName = (base: string, activeNames: string[]): string => {
  const trimmed = base.trim()
  if (!trimmed) return trimmed

  const { stem } = parseSeries(trimmed)
  const normalizedStem = normalizeTemplateText(stem)
  const active = activeNames.map((name) => parseSeries(name))
  const taken = new Set(active.map(({ trimmed: activeName }) => normalizeTemplateText(activeName)))

  if (!taken.has(normalizeTemplateText(trimmed))) {
    return trimmed
  }

  let maxSuffix = 1
  for (const entry of active) {
    if (normalizeTemplateText(entry.stem) !== normalizedStem) continue
    const suffix = entry.suffix ?? 1
    if (suffix > maxSuffix) {
      maxSuffix = suffix
    }
  }

  return `${stem} ${maxSuffix + 1}`.trim()
}

export const getTransactionInitialFocus = (input: {
  isEdit: boolean
  fromTemplate: boolean
  amount: string
  description: string
}): 'amount' | 'description' | null => {
  if (input.isEdit) {
    return null
  }

  if (input.fromTemplate) {
    if (!input.amount.trim()) return 'amount'
    if (!input.description.trim()) return 'description'
    return null
  }

  if (!input.amount.trim()) {
    return 'amount'
  }

  return null
}
