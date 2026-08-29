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
const mockSetAutoBackup = jest.fn();

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

jest.mock('@/libs/background', () => ({
  setAutoBackup: (...args: unknown[]) => mockSetAutoBackup(...args),
}));

jest.mock('@/libs/backup', () => ({
  createLocalBackup: (...args: unknown[]) => mockCreateLocalBackup(...args),
  importDatabase: (...args: unknown[]) => mockImportDatabase(...args),
  validateSqliteFile: (...args: unknown[]) => mockValidateSqliteFile(...args),
}));

jest.mock('@/libs/app-runtime', () => ({
  reinitializeAppRuntime: (...args: unknown[]) => mockReinitializeRuntime(...args),
  waitForLaunchTemplateProcessing: (...args: unknown[]) => mockWaitForLaunchProcessing(...args),
}));

jest.mock('@expo/ui', () => {
  const React = jest.requireActual('react');
  const { Pressable, Switch: RNSwitch, Text: RNText, View } = jest.requireActual('react-native');

  const Text = ({ children, textStyle, onPress, testID }: {
    children?: React.ReactNode;
    textStyle?: { color?: string };
    onPress?: () => void;
    testID?: string;
  }) => React.createElement(RNText, { testID, style: textStyle, onPress }, children);

  const Switch = ({ value, onValueChange, testID }: {
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    testID?: string;
  }) => React.createElement(RNSwitch, { testID, value, onValueChange });

  const Button = ({ label, children, onPress, testID }: {
    label?: string;
    children?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => React.createElement(
    Pressable,
    { testID, onPress },
    children ?? React.createElement(RNText, null, label),
  );

  const Picker = ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
    React.createElement(View, { testID }, children);
  Picker.Item = function PickerItem() {
    return null;
  };

  const Row = ({ children, onPress, testID }: {
    children?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => React.createElement(onPress ? Pressable : View, { testID, onPress }, children);
  const Column = Row;
  const Icon = () => null;
  const Spacer = () => null;
  const Host = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);

  const FieldGroup = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  FieldGroup.Section = function FieldGroupSection({
    children,
    title,
  }: {
    children?: React.ReactNode;
    title?: string;
  }) {
    return React.createElement(View, null, React.createElement(RNText, null, title), children);
  };
  FieldGroup.SectionHeader = function FieldGroupSectionHeader({
    children,
  }: {
    children?: React.ReactNode;
  }) {
    return React.createElement(View, null, children);
  };
  FieldGroup.SectionFooter = function FieldGroupSectionFooter({
    children,
  }: {
    children?: React.ReactNode;
  }) {
    return React.createElement(View, null, children);
  };

  return { Host, FieldGroup, Switch, Text, Button, Picker, Row, Column, Icon, Spacer };
});

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
    mockSetAutoBackup.mockResolvedValue(undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a path-free confirmation after creating a local backup', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('backup-now'));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Backup created'));
    expect(mockCreateLocalBackup).toHaveBeenCalledTimes(1);
  });

  it('registers daily auto backup when enabled', async () => {
    const screen = await render(<SettingsScreen />);

    await fireEvent(screen.getByTestId('auto-backup'), 'valueChange', true);

    await waitFor(() => expect(mockSetAutoBackup).toHaveBeenCalledWith('daily'));
  });

  it('waits, imports, reinitializes imported state, then returns to normal tabs', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('import-database'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(
      'Import database',
      expect.any(String),
      expect.any(Array),
    ));
    const confirmation = alert.mock.calls.find(([title]) => title === 'Import database')!;
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

    await fireEvent.press(screen.getByTestId('reset-all-data'));
    const confirmation = alert.mock.calls.find(([title]) => title === 'Reset all data')!;
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
