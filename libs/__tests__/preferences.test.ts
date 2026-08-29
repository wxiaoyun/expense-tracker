/** @jest-environment node */

jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite')
  const database = new DatabaseSync(':memory:')
  const normalizeParams = (params?: unknown[]) => params ?? []

  return {
    openDatabaseSync: () => ({
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
      withTransactionSync: (task: () => void) => task(),
    }),
  }
})

import { getDefaultStore } from 'jotai'

import { db, settings } from '@/db'
import {
  loadPreferences,
  PREFERENCE_KEYS,
  savePreference,
  suggestionLookbackAtom,
} from '../preferences'

describe('template suggestion lookback preference', () => {
  beforeEach(async () => {
    await db.delete(settings).run()
    getDefaultStore().set(suggestionLookbackAtom, '3m')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('defaults to three months', () => {
    loadPreferences()
    expect(getDefaultStore().get(suggestionLookbackAtom)).toBe('3m')
  })

  it.each(['1m', '3m', '6m', '12m', 'all'] as const)('loads the allowed value %s', async (value) => {
    await db.insert(settings).values({ key: PREFERENCE_KEYS.suggestionLookback, value }).run()
    loadPreferences()
    expect(getDefaultStore().get(suggestionLookbackAtom)).toBe(value)
  })

  it('falls back after failed reads and logs keys without values', () => {
    getDefaultStore().set(suggestionLookbackAtom, '12m')
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined)
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const select = jest.spyOn(db, 'select').mockImplementation((() => {
      throw new Error('forced preference read failure')
    }) as typeof db.select)

    loadPreferences()

    expect(getDefaultStore().get(suggestionLookbackAtom)).toBe('3m')
    expect(info).toHaveBeenCalledWith(
      '[preferences.read][stage=query] reading setting',
      { key: PREFERENCE_KEYS.suggestionLookback },
    )
    expect(error).toHaveBeenCalledWith(
      '[preferences.read][stage=query] setting read failed',
      { key: PREFERENCE_KEYS.suggestionLookback, error: 'Error: forced preference read failure' },
    )
    expect(JSON.stringify([...info.mock.calls, ...error.mock.calls])).not.toContain('12m')

    select.mockRestore()
    info.mockRestore()
    error.mockRestore()
  })

  it('rejects failed saves and logs the key without the value', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined)
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const insert = jest.spyOn(db, 'insert').mockImplementation((() => {
      throw new Error('forced preference save failure')
    }) as typeof db.insert)

    await expect(savePreference(PREFERENCE_KEYS.suggestionLookback, 'secret-value'))
      .rejects.toThrow('forced preference save failure')
    expect(info).toHaveBeenCalledWith(
      '[preferences.save][stage=upsert] saving setting',
      { key: PREFERENCE_KEYS.suggestionLookback },
    )
    expect(error).toHaveBeenCalledWith(
      '[preferences.save][stage=upsert] setting save failed',
      { key: PREFERENCE_KEYS.suggestionLookback, error: 'Error: forced preference save failure' },
    )
    expect(JSON.stringify([...info.mock.calls, ...error.mock.calls])).not.toContain('secret-value')

    insert.mockRestore()
    info.mockRestore()
    error.mockRestore()
  })

  it('falls back to three months for an invalid persisted value', async () => {
    getDefaultStore().set(suggestionLookbackAtom, '12m')
    await db.insert(settings).values({ key: PREFERENCE_KEYS.suggestionLookback, value: '2y' }).run()
    loadPreferences()
    expect(getDefaultStore().get(suggestionLookbackAtom)).toBe('3m')
  })
})
