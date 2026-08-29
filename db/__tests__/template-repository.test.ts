/** @jest-environment node */

jest.mock('expo-crypto', () => {
  let nextId = 0
  return { randomUUID: () => `test-id-${++nextId}` }
})

jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite')
  const database = new DatabaseSync(':memory:')
  ;(globalThis as { __templateRepositoryDatabase?: typeof database }).__templateRepositoryDatabase = database
  const normalizeParams = (params?: unknown[]) => params ?? []

  const connection = {
    execSync: (sql: string) => database.exec(sql),
    getFirstSync: (sql: string, ...params: unknown[]) => database.prepare(sql).get(...params) ?? null,
    getAllSync: (sql: string, ...params: unknown[]) => database.prepare(sql).all(...params),
    runSync: (sql: string, ...params: unknown[]) => database.prepare(sql).run(...params),
    prepareSync: (sql: string) => {
      const statement = database.prepare(sql)
      return {
        executeSync: (params?: unknown[]) => {
          const normalized = normalizeParams(params)
          const result = statement.run(...normalized)
          return {
            changes: result.changes,
            lastInsertRowId: Number(result.lastInsertRowid),
            getAllSync: () => statement.all(...normalized),
            getFirstSync: () => statement.get(...normalized) ?? null,
          }
        },
        executeForRawResultSync: (params?: unknown[]) => {
          const normalized = normalizeParams(params)
          return {
            getAllSync: () => statement.all(...normalized).map((row: Record<string, unknown>) => Object.values(row)),
          }
        },
      }
    },
    withTransactionSync: (task: () => void) => {
      database.exec('BEGIN')
      try {
        task()
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },
    withExclusiveTransactionAsync: async (task: (tx: {
      getFirstAsync: (sql: string, ...params: unknown[]) => Promise<Record<string, unknown> | null>
      runAsync: (sql: string, ...params: unknown[]) => Promise<{ changes: number }>
    }) => Promise<void>) => {
      const testState = globalThis as {
        __beforeTemplateExclusiveTransaction?: () => void | Promise<void>
      }
      const beforeTransaction = testState.__beforeTemplateExclusiveTransaction
      testState.__beforeTemplateExclusiveTransaction = undefined
      await beforeTransaction?.()

      database.exec('BEGIN EXCLUSIVE')
      try {
        await task({
          getFirstAsync: async (sql: string, ...params: unknown[]) =>
            database.prepare(sql).get(...params) ?? null,
          runAsync: async (sql: string, ...params: unknown[]) => {
            const result = database.prepare(sql).run(...params)
            return { changes: Number(result.changes) }
          },
        })
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },
  }

  return { openDatabaseSync: () => connection }
})

import { eq } from 'drizzle-orm'

import { db, transactionTemplates, transactions } from '../index'
import type { TemplateDraft } from '../template-core'
import {
  backfillTemplate,
  convertTemplateToManual,
  createTemplate,
  getNextAvailableTemplateName,
  getTemplate,
  listHistoricalTemplateSuggestions,
  listTemplates,
  pauseTemplate,
  previewTemplateBackfill,
  processScheduledTemplates,
  quickAddTemplate,
  resumeTemplate,
  softDeleteTemplate,
  updateTemplate,
} from '../template'

const validDraft = (overrides: Partial<TemplateDraft> = {}): TemplateDraft => ({
  name: 'Coffee',
  amount: 5,
  transactionType: 'expense',
  description: 'Coffee',
  category: 'Food',
  notes: null,
  verified: null,
  recurrenceValue: null,
  startDate: null,
  scheduleCursorAt: null,
  scheduleActive: false,
  ...overrides,
})

const scheduledDraft = (overrides: Partial<TemplateDraft> = {}): TemplateDraft => validDraft({
  name: 'Rent',
  amount: 1000,
  description: 'Rent',
  category: 'Home',
  recurrenceValue: '0 0 1 * *',
  startDate: Date.parse('2026-01-01T00:00:00.000Z'),
  scheduleActive: true,
  ...overrides,
})

const clearTables = async () => {
  ;(globalThis as { __beforeTemplateExclusiveTransaction?: () => void | Promise<void> })
    .__beforeTemplateExclusiveTransaction = undefined
  await db.delete(transactions).run()
  await db.delete(transactionTemplates).run()
}

const beforeNextExclusiveTransaction = (callback: () => void | Promise<void>) => {
  ;(globalThis as { __beforeTemplateExclusiveTransaction?: () => void | Promise<void> })
    .__beforeTemplateExclusiveTransaction = callback
}

describe('template repository', () => {
  beforeEach(clearTables)
  afterAll(clearTables)

  it('enforces active normalized names and allows a deleted name to be reused', async () => {
    const first = await createTemplate(validDraft())
    expect(first).toEqual(expect.objectContaining({ name: 'Coffee' }))
    await expect(createTemplate(validDraft({ name: ' coffee ' }))).rejects.toThrow('Template name already exists')

    await expect(softDeleteTemplate(first.id, 100)).resolves.toBe(true)
    expect(await getTemplate(first.id)).toBeNull()
    await expect(createTemplate(validDraft({ name: 'coffee' }))).resolves.toEqual(expect.objectContaining({ name: 'coffee' }))
  })

  it('suggests the next active-name suffix while excluding the edited template', async () => {
    const first = await createTemplate(validDraft())
    await createTemplate(validDraft({ name: 'Coffee 2' }))

    await expect(getNextAvailableTemplateName(' coffee ')).resolves.toBe('coffee 3')
    await expect(getNextAvailableTemplateName('Coffee', first.id)).resolves.toBe('Coffee')
  })

  it('filters by search, manual or scheduled type, and category', async () => {
    await createTemplate(validDraft({ name: 'Morning Coffee', category: 'Food' }))
    await createTemplate(scheduledDraft({ name: 'Monthly Rent', category: 'Home' }))
    await createTemplate(validDraft({ name: 'Bus pass', description: 'Bus pass', category: 'Travel' }))

    expect((await listTemplates({ search: 'coffee' })).map(({ name }) => name)).toEqual(['Morning Coffee'])
    expect((await listTemplates({ type: 'scheduled' })).map(({ name }) => name)).toEqual(['Monthly Rent'])
    expect((await listTemplates({ type: 'manual' })).map(({ name }) => name).sort()).toEqual(['Bus pass', 'Morning Coffee'])
    expect((await listTemplates({ category: 'Travel' })).map(({ name }) => name)).toEqual(['Bus pass'])
  })

  it('sorts by latest active linked transaction and then update time', async () => {
    const first = await createTemplate(validDraft({ name: 'First' }), 10)
    const second = await createTemplate(validDraft({ name: 'Second' }), 20)
    const third = await createTemplate(validDraft({ name: 'Third' }), 30)
    await db.insert(transactions).values([
      { id: 'old', amount: -5, transactionDate: 100, description: 'First', category: 'Food', templateId: first.id, verified: 0, notes: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 'new', amount: -5, transactionDate: 200, description: 'Second', category: 'Food', templateId: second.id, verified: 0, notes: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 'deleted-newest', amount: -5, transactionDate: 300, description: 'First', category: 'Food', templateId: first.id, verified: 0, notes: null, deletedAt: 301, createdAt: 1, updatedAt: 1 },
    ]).run()

    expect((await listTemplates()).map(({ id }) => id)).toEqual([second.id, first.id, third.id])
  })

  it('uses defaults and source linkage for Quick Add without moving a scheduled cursor', async () => {
    const template = await createTemplate(scheduledDraft({
      category: null,
      notes: '  monthly  ',
      verified: true,
    }))
    const cursor = template.scheduleCursorAt

    await expect(quickAddTemplate(template.id, 123)).resolves.toEqual(expect.objectContaining({
      amount: -1000,
      transactionDate: 123,
      description: 'Rent',
      category: 'Other',
      notes: 'monthly',
      verified: 1,
      templateId: template.id,
    }))
    expect((await getTemplate(template.id))?.scheduleCursorAt).toBe(cursor)
  })

  it('rejects Quick Add when a manual template is incomplete', async () => {
    const partial = await createTemplate(validDraft({ amount: null, description: null, category: 'Food' }))
    await expect(quickAddTemplate(partial.id, 123)).rejects.toThrow('Quick Add requires a positive amount and description')
  })

  it('rejects resuming a manual template without mutating it', async () => {
    const template = await createTemplate(validDraft())
    const before = await db.select().from(transactionTemplates).where(eq(transactionTemplates.id, template.id)).get()

    await expect(resumeTemplate(template.id, 70)).rejects.toThrow('Only complete scheduled templates can be resumed')

    expect(await db.select().from(transactionTemplates).where(eq(transactionTemplates.id, template.id)).get()).toEqual(before)
  })

  it('rejects resuming an incomplete migrated schedule without mutating it', async () => {
    await db.insert(transactionTemplates).values({
      id: 'migrated-incomplete', name: 'Legacy', normalizedName: 'legacy', amount: 0,
      transactionType: 'expense', description: 'Legacy', category: 'Other', notes: null,
      verified: null, recurrenceValue: '0 0 1 * *', startDate: 1, scheduleCursorAt: 1,
      scheduleActive: 0, deletedAt: null, createdAt: 1, updatedAt: 1,
    }).run()
    const before = await db.select().from(transactionTemplates).where(eq(transactionTemplates.id, 'migrated-incomplete')).get()

    await expect(resumeTemplate('migrated-incomplete', 70))
      .rejects.toThrow('Only complete scheduled templates can be resumed')

    expect(await db.select().from(transactionTemplates).where(eq(transactionTemplates.id, 'migrated-incomplete')).get()).toEqual(before)
  })

  it('rejects resuming a whitespace-recurrence preserved row without mutating it', async () => {
    await db.insert(transactionTemplates).values({
      id: 'whitespace-recurrence', name: 'Whitespace recurrence', normalizedName: 'whitespace recurrence', amount: 10,
      transactionType: 'expense', description: 'Legacy schedule', category: 'Other', notes: null,
      verified: null, recurrenceValue: '   ', startDate: 1, scheduleCursorAt: 1,
      scheduleActive: 0, deletedAt: null, createdAt: 1, updatedAt: 1,
    }).run()
    const before = await db.select().from(transactionTemplates).where(eq(transactionTemplates.id, 'whitespace-recurrence')).get()

    await expect(resumeTemplate('whitespace-recurrence', 70))
      .rejects.toThrow('Only complete scheduled templates can be resumed')

    expect(await db.select().from(transactionTemplates).where(eq(transactionTemplates.id, 'whitespace-recurrence')).get()).toEqual(before)
  })

  it('resumes a complete valid scheduled template from now', async () => {
    const template = await createTemplate(scheduledDraft())
    await pauseTemplate(template.id, 50)

    await expect(resumeTemplate(template.id, 70)).resolves.toEqual(expect.objectContaining({
      scheduleActive: 1,
      scheduleCursorAt: 70,
      updatedAt: 70,
    }))
  })

  it('keeps paused schedules available manually, resumes from now, and converts to manual', async () => {
    const template = await createTemplate(scheduledDraft())
    await pauseTemplate(template.id, 50)
    await expect(processScheduledTemplates(new Date('2026-04-15T00:00:00.000Z'))).resolves.toEqual([])
    await expect(quickAddTemplate(template.id, 60)).resolves.toEqual(expect.objectContaining({ templateId: template.id }))

    await resumeTemplate(template.id, 70)
    expect(await getTemplate(template.id)).toEqual(expect.objectContaining({ scheduleActive: 1, scheduleCursorAt: 70 }))

    await convertTemplateToManual(template.id, 80)
    expect(await getTemplate(template.id)).toEqual(expect.objectContaining({
      recurrenceValue: null,
      startDate: null,
      scheduleCursorAt: null,
      scheduleActive: 0,
    }))
  })

  it('preserves a cursor for ordinary edits and resets it for cron or start edits', async () => {
    const template = await createTemplate(scheduledDraft())
    await updateTemplate(template.id, scheduledDraft({ name: 'Updated rent' }), 50)
    expect((await getTemplate(template.id))?.scheduleCursorAt).toBe(template.startDate)

    await updateTemplate(template.id, scheduledDraft({ name: 'Updated rent', recurrenceValue: '0 0 2 * *' }), 60)
    expect((await getTemplate(template.id))?.scheduleCursorAt).toBe(60)
  })

  it('resets the cursor when an edit activates an inactive schedule alongside other changes', async () => {
    const template = await createTemplate(scheduledDraft())
    await pauseTemplate(template.id, 50)

    await expect(updateTemplate(template.id, scheduledDraft({
      name: 'Activated and edited rent',
      category: 'Bills',
      scheduleActive: true,
    }), 70)).resolves.toEqual(expect.objectContaining({
      name: 'Activated and edited rent',
      category: 'Bills',
      scheduleActive: 1,
      scheduleCursorAt: 70,
      updatedAt: 70,
    }))
  })

  it('excludes incomplete active schedule rows before processing without mutating them', async () => {
    const base = {
      transactionType: 'expense' as const,
      category: 'Other',
      notes: null,
      verified: null,
      recurrenceValue: '0 0 1 * *',
      scheduleActive: 1,
      deletedAt: null,
      createdAt: 1,
      updatedAt: 1,
    }
    await db.insert(transactionTemplates).values([
      { ...base, id: 'missing-amount', name: 'Missing amount', normalizedName: 'missing amount', amount: null, description: 'One', startDate: 1, scheduleCursorAt: 1 },
      { ...base, id: 'zero-amount', name: 'Zero amount', normalizedName: 'zero amount', amount: 0, description: 'Two', startDate: 2, scheduleCursorAt: 2 },
      { ...base, id: 'missing-description', name: 'Missing description', normalizedName: 'missing description', amount: 3, description: null, startDate: 3, scheduleCursorAt: 3 },
      { ...base, id: 'missing-start', name: 'Missing start', normalizedName: 'missing start', amount: 4, description: 'Four', startDate: null, scheduleCursorAt: 4 },
      { ...base, id: 'missing-cursor', name: 'Missing cursor', normalizedName: 'missing cursor', amount: 5, description: 'Five', startDate: 5, scheduleCursorAt: null },
    ]).run()
    const before = await db.select().from(transactionTemplates).all()

    await expect(processScheduledTemplates(new Date(10000000000))).resolves.toEqual([])

    expect(await db.select().from(transactions).all()).toEqual([])
    expect(await db.select().from(transactionTemplates).all()).toEqual(before)
  })

  it.each([
    {
      name: 'pause',
      mutate: async (id: string) => {
        await db.update(transactionTemplates).set({ scheduleActive: 0 }).where(eq(transactionTemplates.id, id)).run()
      },
      expected: { scheduleActive: 0 },
    },
    {
      name: 'soft deletion',
      mutate: async (id: string) => {
        await db.update(transactionTemplates).set({ deletedAt: 222, updatedAt: 222 }).where(eq(transactionTemplates.id, id)).run()
      },
      expected: { deletedAt: 222, updatedAt: 222 },
    },
    {
      name: 'cron and start edit',
      mutate: async (id: string) => {
        await db.update(transactionTemplates).set({
          recurrenceValue: '0 0 2 * *',
          startDate: 333,
          scheduleCursorAt: 444,
          updatedAt: 555,
        }).where(eq(transactionTemplates.id, id)).run()
      },
      expected: { recurrenceValue: '0 0 2 * *', startDate: 333, scheduleCursorAt: 444, updatedAt: 555 },
    },
  ])('rejects a stale scheduler snapshot after $name before transaction entry', async ({ mutate, expected }) => {
    const template = await createTemplate(scheduledDraft())
    beforeNextExclusiveTransaction(() => mutate(template.id))

    await expect(processScheduledTemplates(new Date('2026-04-15T00:00:00.000Z')))
      .resolves.toEqual([{ id: template.id, incurred: null }])

    expect(await db.select().from(transactions).all()).toEqual([])
    const current = await db.select().from(transactionTemplates).where(eq(transactionTemplates.id, template.id)).get()
    expect(current).toEqual(expect.objectContaining(expected))
  })

  it('rolls back scheduler occurrences when the guarded cursor update changes no rows', async () => {
    const template = await createTemplate(scheduledDraft())
    const database = (globalThis as unknown as {
      __templateRepositoryDatabase: { exec: (source: string) => void }
    }).__templateRepositoryDatabase
    database.exec(`
      CREATE TRIGGER ignore_scheduler_cursor_update
      BEFORE UPDATE OF schedule_cursor_at ON transaction_templates
      WHEN NEW.schedule_cursor_at <> OLD.schedule_cursor_at
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `)

    await expect(processScheduledTemplates(new Date('2026-04-15T00:00:00.000Z')))
      .resolves.toEqual([{ id: template.id, incurred: null }])
    database.exec('DROP TRIGGER ignore_scheduler_cursor_update')

    expect(await db.select().from(transactions).all()).toEqual([])
    expect((await getTemplate(template.id))?.scheduleCursorAt).toBe(template.scheduleCursorAt)
  })

  it('uses deterministic occurrence ids so scheduler retries insert no duplicates', async () => {
    const template = await createTemplate(scheduledDraft())
    const now = new Date('2026-04-15T00:00:00.000Z')

    await expect(processScheduledTemplates(now)).resolves.toEqual([{ id: template.id, incurred: 3 }])
    await db.update(transactionTemplates).set({ scheduleCursorAt: template.startDate }).where(eq(transactionTemplates.id, template.id)).run()
    await expect(processScheduledTemplates(now)).resolves.toEqual([{ id: template.id, incurred: 0 }])
    expect((await db.select().from(transactions).where(eq(transactions.templateId, template.id)).all())).toHaveLength(3)
  })

  it('previews backfill count and inserts occurrences with the cursor atomically', async () => {
    const draft = scheduledDraft()
    const now = Date.parse('2026-04-15T00:00:00.000Z')
    expect(await previewTemplateBackfill(draft, now)).toBe(3)

    const template = await createTemplate(draft)
    await expect(backfillTemplate(template.id, now)).resolves.toBe(3)
    const inserted = await db.select().from(transactions).where(eq(transactions.templateId, template.id)).all()
    expect(inserted).toHaveLength(3)
    expect((await getTemplate(template.id))?.scheduleCursorAt).toBe(Math.max(...inserted.map(({ transactionDate }) => transactionDate)))
  })

  it.each([
    {
      name: 'pause',
      mutate: async (id: string) => {
        await db.update(transactionTemplates).set({ scheduleActive: 0 }).where(eq(transactionTemplates.id, id)).run()
      },
      expected: { scheduleActive: 0 },
    },
    {
      name: 'soft deletion',
      mutate: async (id: string) => {
        await db.update(transactionTemplates).set({ deletedAt: 622, updatedAt: 622 }).where(eq(transactionTemplates.id, id)).run()
      },
      expected: { deletedAt: 622, updatedAt: 622 },
    },
    {
      name: 'cron and start edit',
      mutate: async (id: string) => {
        await db.update(transactionTemplates).set({
          recurrenceValue: '0 0 3 * *',
          startDate: 733,
          scheduleCursorAt: 744,
          updatedAt: 755,
        }).where(eq(transactionTemplates.id, id)).run()
      },
      expected: { recurrenceValue: '0 0 3 * *', startDate: 733, scheduleCursorAt: 744, updatedAt: 755 },
    },
  ])('rejects a stale backfill snapshot after $name before transaction entry', async ({ mutate, expected }) => {
    const template = await createTemplate(scheduledDraft())
    beforeNextExclusiveTransaction(() => mutate(template.id))

    await expect(backfillTemplate(template.id, Date.parse('2026-04-15T00:00:00.000Z')))
      .rejects.toThrow()

    expect(await db.select().from(transactions).all()).toEqual([])
    const current = await db.select().from(transactionTemplates).where(eq(transactionTemplates.id, template.id)).get()
    expect(current).toEqual(expect.objectContaining(expected))
  })

  it('rolls back backfill occurrences when the guarded cursor update changes no rows', async () => {
    const template = await createTemplate(scheduledDraft())
    const database = (globalThis as unknown as {
      __templateRepositoryDatabase: { exec: (source: string) => void }
    }).__templateRepositoryDatabase
    database.exec(`
      CREATE TRIGGER ignore_backfill_cursor_update
      BEFORE UPDATE OF schedule_cursor_at ON transaction_templates
      WHEN NEW.schedule_cursor_at <> OLD.schedule_cursor_at
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `)

    await expect(backfillTemplate(template.id, Date.parse('2026-04-15T00:00:00.000Z')))
      .rejects.toThrow('Scheduled template changed while committing occurrences')
    database.exec('DROP TRIGGER ignore_backfill_cursor_update')

    expect(await db.select().from(transactions).all()).toEqual([])
    expect((await getTemplate(template.id))?.scheduleCursorAt).toBe(template.scheduleCursorAt)
  })

  it('rolls back occurrence insertion and cursor update together when backfill fails', async () => {
    const template = await createTemplate(scheduledDraft())
    const database = (globalThis as unknown as {
      __templateRepositoryDatabase: { exec: (source: string) => void }
    }).__templateRepositoryDatabase
    database.exec(`
      CREATE TRIGGER fail_second_occurrence
      BEFORE INSERT ON transactions
      WHEN (SELECT COUNT(*) FROM transactions) = 1
      BEGIN
        SELECT RAISE(ABORT, 'forced occurrence failure');
      END;
    `)

    await expect(backfillTemplate(template.id, Date.parse('2026-04-15T00:00:00.000Z')))
      .rejects.toThrow('forced occurrence failure')
    database.exec('DROP TRIGGER fail_second_occurrence')

    expect(await db.select().from(transactions).all()).toEqual([])
    expect((await getTemplate(template.id))?.scheduleCursorAt).toBe(template.startDate)
  })

  it('uses explicit historical cutoff and excludes linked and active-template matches', async () => {
    const now = Date.parse('2026-08-15T00:00:00.000Z')
    await createTemplate(validDraft({ name: 'Coffee existing', description: 'Coffee', category: 'Food' }))
    await db.insert(transactions).values([
      { id: 'tea-1', amount: -3, transactionDate: Date.parse('2026-06-01T00:00:00.000Z'), description: 'Tea', category: 'Food', templateId: null, verified: 0, notes: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 'tea-2', amount: -3, transactionDate: Date.parse('2026-07-01T00:00:00.000Z'), description: 'Tea', category: 'Food', templateId: null, verified: 0, notes: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 'tea-3', amount: -3, transactionDate: Date.parse('2026-08-01T00:00:00.000Z'), description: 'Tea', category: 'Food', templateId: null, verified: 0, notes: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 'coffee-1', amount: -5, transactionDate: now - 3, description: 'Coffee', category: 'Food', templateId: null, verified: 0, notes: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 'coffee-2', amount: -5, transactionDate: now - 2, description: 'Coffee', category: 'Food', templateId: null, verified: 0, notes: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 'coffee-3', amount: -5, transactionDate: now - 1, description: 'Coffee', category: 'Food', templateId: null, verified: 0, notes: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
      { id: 'linked-tea', amount: -3, transactionDate: now, description: 'Tea', category: 'Food', templateId: 'other', verified: 0, notes: null, deletedAt: null, createdAt: 1, updatedAt: 1 },
    ]).run()

    expect(await listHistoricalTemplateSuggestions('3m', now)).toEqual([
      expect.objectContaining({ name: 'Tea', count: 3 }),
    ])
    expect(await listHistoricalTemplateSuggestions('1m', now)).toEqual([])
  })


})
