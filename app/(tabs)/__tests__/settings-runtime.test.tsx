import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import SettingsScreen from '../settings';

const mockReplace = jest.fn();
const mockGetDocument = jest.fn();
const mockValidateSqliteFile = jest.fn();
const mockCreateLocalBackup = jest.fn();
const mockImportDatabase = jest.fn();
const mockResetAllData = jest.fn();
const mockWaitForLaunchProcessing = jest.fn();
const mockReinitializeRuntime = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocument(...args),
}));

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));

jest.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ get: () => null }) }) }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({ run: jest.fn().mockResolvedValue(undefined) }),
      }),
    }),
  },
}));

jest.mock('@/db/reset', () => {
  class ResetDataError extends Error {
    stage = 'test';
  }
  return {
    ResetDataError,
    resetAllData: (...args: unknown[]) => mockResetAllData(...args),
  };
});

jest.mock('@/libs/background', () => ({ setAutoBackup: jest.fn() }));

jest.mock('@/libs/backup', () => ({
  createLocalBackup: (...args: unknown[]) => mockCreateLocalBackup(...args),
  importDatabase: (...args: unknown[]) => mockImportDatabase(...args),
  validateSqliteFile: (...args: unknown[]) => mockValidateSqliteFile(...args),
}));

jest.mock('@/libs/app-runtime', () => ({
  reinitializeAppRuntime: (...args: unknown[]) => mockReinitializeRuntime(...args),
  waitForLaunchTemplateProcessing: (...args: unknown[]) => mockWaitForLaunchProcessing(...args),
}));

jest.mock('react-native-ios-context-menu', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    ContextMenuButton: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
}, { virtual: true });

describe('Settings database runtime orchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocument.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///import.db' }],
    });
    mockValidateSqliteFile.mockResolvedValue(undefined);
    mockCreateLocalBackup.mockResolvedValue('file:///recovery.db');
    mockImportDatabase.mockResolvedValue({ mode: 'restore', sourceVersion: 3 });
    mockResetAllData.mockResolvedValue(undefined);
    mockWaitForLaunchProcessing.mockResolvedValue(undefined);
    mockReinitializeRuntime.mockResolvedValue(undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('waits, imports, reinitializes imported state, then returns to normal tabs', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByText('Import Database'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(
      'Import Database',
      expect.any(String),
      expect.any(Array),
    ));
    const confirmation = alert.mock.calls.find(([title]) => title === 'Import Database')!;
    await act(async () => confirmation[2]![1].onPress?.());

    await waitFor(() => expect(mockReinitializeRuntime)
      .toHaveBeenCalledWith({ processImportedSchedules: true }));
    expect(mockWaitForLaunchProcessing).toHaveBeenCalledTimes(1);
    expect(mockImportDatabase).toHaveBeenCalledWith('file:///import.db');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    expect(mockImportDatabase.mock.invocationCallOrder[0])
      .toBeLessThan(mockReinitializeRuntime.mock.invocationCallOrder[0]);
    expect(mockReinitializeRuntime.mock.invocationCallOrder[0])
      .toBeLessThan(mockReplace.mock.invocationCallOrder[0]);
  });

  it('waits, resets, reinitializes defaults and one-shot state, then opens migration', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByText('Reset All Data'));
    const confirmation = alert.mock.calls.find(([title]) => title === 'Reset All Data')!;
    await act(async () => confirmation[2]![1].onPress?.());

    await waitFor(() => expect(mockReinitializeRuntime).toHaveBeenCalledWith());
    expect(mockWaitForLaunchProcessing).toHaveBeenCalledTimes(1);
    expect(mockResetAllData).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/migrate');
    expect(mockResetAllData.mock.invocationCallOrder[0])
      .toBeLessThan(mockReinitializeRuntime.mock.invocationCallOrder[0]);
    expect(mockReinitializeRuntime.mock.invocationCallOrder[0])
      .toBeLessThan(mockReplace.mock.invocationCallOrder[0]);
  });
});
