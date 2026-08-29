import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { Transaction, TransactionTemplate } from '@/db/schema';
import HomeScreen from '@/app/(tabs)/index';
import { TransactionRow } from '../Row';
import { TransactionMenu } from '../transaction-menu';

const mockPush = jest.fn();
const mockUseQuery = jest.fn();
const mockUseInfiniteTransactionListQuery = jest.fn();
const mockInvalidateTransactions = jest.fn();
const mockInvalidateTransactionsAndTemplates = jest.fn();
const mockSetVerification = jest.fn();
const mockSoftDeleteTransaction = jest.fn();
const mockShowConfirmDialog = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

jest.mock('@/hooks/useTransactionsQuery', () => ({
  queryKeys: {
    templates: { list: () => ['templates', 'list', {}] },
    transactions: { all: () => ['transactions'] },
  },
  useInfiniteTransactionListQuery: (...args: unknown[]) => mockUseInfiniteTransactionListQuery(...args),
}));

jest.mock('@/hooks/useQueryClient', () => ({
  useInvalidateTransactions: () => mockInvalidateTransactions,
  useInvalidateTransactionsAndTemplates: () => mockInvalidateTransactionsAndTemplates,
}));

jest.mock('@/hooks/useFilter', () => ({
  computeDateRange: () => ({ start: new Date(0), end: new Date(1) }),
  endOfDay: (date: Date) => date,
  useCategoryFilter: () => [[], jest.fn()],
  useDateRange: () => [{ preset: 'all', start: new Date(0), end: new Date(1) }, jest.fn()],
  useSearch: () => ['', jest.fn()],
}));

jest.mock('@/db/transaction', () => ({
  listCategories: jest.fn(),
  setVerification: (...args: unknown[]) => mockSetVerification(...args),
  softDeleteTransaction: (...args: unknown[]) => mockSoftDeleteTransaction(...args),
}));

jest.mock('@/db/template', () => ({
  listTemplates: jest.fn(),
}));

jest.mock('@/libs/dialog', () => ({
  showConfirmDialog: (...args: unknown[]) => mockShowConfirmDialog(...args),
}));

jest.mock('@/components/transactions/add-expense-button', () => ({
  AddExpenseButton: () => null,
}));

jest.mock('@/components/transactions/expense-filter-bar', () => ({
  ExpenseFilterBar: () => null,
}));

jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    FlashList: ({ data, renderItem }: { data: unknown[]; renderItem: (info: { item: unknown }) => React.ReactNode }) =>
      React.createElement(View, null, data.map((item, index) => React.createElement(
        React.Fragment,
        { key: index },
        renderItem({ item }),
      ))),
  };
});

jest.mock('@react-native-menu/menu', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    MenuView: ({
      actions,
      children,
      onPressAction,
      shouldOpenOnLongPress,
    }: {
      actions: { id?: string; title: string }[];
      children: React.ReactNode;
      onPressAction?: (event: { nativeEvent: { event: string } }) => void;
      shouldOpenOnLongPress?: boolean;
    }) => React.createElement(
      View,
      { testID: 'transaction-menu-view', actions, shouldOpenOnLongPress },
      children,
      actions.map((action) => React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: `menu action ${action.id}`,
          key: action.id,
          onPress: () => onPressAction?.({ nativeEvent: { event: action.id ?? '' } }),
          testID: `menu-action-${action.id}`,
        },
        React.createElement(Text, null, action.title),
      )),
    ),
  };
});

jest.mock('@/libs/intl', () => ({ formatCurrency: (amount: number) => `$${amount.toFixed(2)}` }));

const transaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'txn-1',
  amount: -4.5,
  transactionDate: Date.UTC(2026, 7, 29),
  description: 'Coffee',
  category: 'Food',
  templateId: null,
  verified: 0,
  notes: null,
  deletedAt: null,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const template = (overrides: Partial<TransactionTemplate> = {}): TransactionTemplate => ({
  id: 'template-1',
  name: 'Coffee template',
  normalizedName: 'coffee template',
  amount: 4.5,
  transactionType: 'expense',
  description: 'Coffee',
  category: 'Food',
  notes: null,
  verified: 0,
  recurrenceValue: null,
  startDate: null,
  scheduleCursorAt: null,
  scheduleActive: 0,
  deletedAt: null,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe('TransactionMenu', () => {
  it('exposes native menu actions for a transaction without an active template and dispatches by stable id', async () => {
    const callbacks = {
      onEdit: jest.fn(),
      onSaveAsTemplate: jest.fn(),
      onViewTemplate: jest.fn(),
      onDelete: jest.fn(),
    };
    const screen = await render(
      <TransactionMenu
        transactionId="txn-1"
        description="Coffee"
        templateId={null}
        hasActiveTemplate={false}
        {...callbacks}
      />,
    );

    const menu = screen.getByTestId('transaction-menu-view');
    expect(menu.props.shouldOpenOnLongPress).toBe(false);
    expect(menu.props.actions).toEqual([
      expect.objectContaining({ id: 'edit', title: 'Edit' }),
      expect.objectContaining({ id: 'save-template', title: 'Save as Template' }),
      expect.objectContaining({ id: 'delete', title: 'Delete', attributes: { destructive: true } }),
    ]);

    await fireEvent.press(screen.getByTestId('menu-action-save-template'));
    await fireEvent.press(screen.getByTestId('menu-action-edit'));
    await fireEvent.press(screen.getByTestId('menu-action-delete'));

    expect(callbacks.onSaveAsTemplate).toHaveBeenCalledWith('txn-1');
    expect(callbacks.onEdit).toHaveBeenCalledWith('txn-1');
    expect(callbacks.onDelete).toHaveBeenCalledWith('txn-1');
  });

  it('exposes View Template instead of Save as Template for a linked active template', async () => {
    const callbacks = {
      onEdit: jest.fn(),
      onSaveAsTemplate: jest.fn(),
      onViewTemplate: jest.fn(),
      onDelete: jest.fn(),
    };
    const screen = await render(
      <TransactionMenu
        transactionId="txn-1"
        description="Coffee"
        templateId="template-1"
        hasActiveTemplate
        {...callbacks}
      />,
    );

    expect(screen.getByTestId('transaction-menu-view').props.actions).toEqual([
      expect.objectContaining({ id: 'edit', title: 'Edit' }),
      expect.objectContaining({ id: 'view-template', title: 'View Template' }),
      expect.objectContaining({ id: 'delete', title: 'Delete', attributes: { destructive: true } }),
    ]);

    await fireEvent.press(screen.getByTestId('menu-action-view-template'));

    expect(callbacks.onViewTemplate).toHaveBeenCalledWith('template-1');
    expect(callbacks.onSaveAsTemplate).not.toHaveBeenCalled();
  });
});

describe('TransactionRow', () => {
  it('edits from the card body while verification and menu remain sibling press targets', async () => {
    const props = {
      onEdit: jest.fn(),
      onSaveAsTemplate: jest.fn(),
      onViewTemplate: jest.fn(),
      onDelete: jest.fn(),
      onToggleVerified: jest.fn(),
    };
    const screen = await render(
      <TransactionRow
        transaction={transaction()}
        hasActiveTemplate={false}
        {...props}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Edit Coffee' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark Coffee verified' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Actions for Coffee' }));

    expect(props.onEdit).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledWith('txn-1');
    expect(props.onToggleVerified).toHaveBeenCalledWith('txn-1', true);
  });
});

describe('HomeScreen transaction action menu integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: readonly unknown[] }) => {
      if (queryKey[0] === 'templates') return { data: [], error: null };
      return { data: [], error: null };
    });
    mockUseInfiniteTransactionListQuery.mockReturnValue({
      data: { pages: [{ items: [transaction()] }] },
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      error: null,
    });
    mockShowConfirmDialog.mockResolvedValue(true);
    mockSoftDeleteTransaction.mockResolvedValue(true);
    mockSetVerification.mockResolvedValue(true);
  });

  it('routes Save as Template and View Template with object pathname params from active template availability', async () => {
    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: readonly unknown[] }) => {
      if (queryKey[0] === 'templates') return { data: [template()], error: null };
      return { data: [], error: null };
    });
    mockUseInfiniteTransactionListQuery.mockReturnValue({
      data: { pages: [{ items: [transaction({ templateId: 'template-1' })] }] },
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      error: null,
    });

    const activeScreen = await render(<HomeScreen />);
    await fireEvent.press(activeScreen.getByTestId('menu-action-view-template'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(drawer)/template-edit',
      params: { id: 'template-1' },
    });

    mockPush.mockClear();
    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: readonly unknown[] }) => {
      if (queryKey[0] === 'templates') return { data: [], error: null };
      return { data: [], error: null };
    });
    const missingTemplateScreen = await render(<HomeScreen />);
    await fireEvent.press(missingTemplateScreen.getByTestId('menu-action-save-template'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(drawer)/template-edit',
      params: { sourceTransactionId: 'txn-1' },
    });
  });

  it('logs template load failures and renders transactions conservatively with Save as Template', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const templateError = new Error('template query failed');
    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: readonly unknown[] }) => {
      if (queryKey[0] === 'templates') return { data: [template()], error: templateError };
      return { data: [], error: null };
    });

    const screen = await render(<HomeScreen />);

    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.getByTestId('transaction-menu-view').props.actions).toEqual([
      expect.objectContaining({ id: 'edit', title: 'Edit' }),
      expect.objectContaining({ id: 'save-template', title: 'Save as Template' }),
      expect.objectContaining({ id: 'delete', title: 'Delete', attributes: { destructive: true } }),
    ]);
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith(
      '[transactions.ui][stage=load_templates] failed',
      { stage: 'load_templates', error: 'Error: template query failed' },
    ));
    errorSpy.mockRestore();
  });

  it('uses structured stages for verification and edit actions', async () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const screen = await render(<HomeScreen />);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark Coffee verified' }));
    await waitFor(() => expect(mockSetVerification).toHaveBeenCalledWith('txn-1', 1));
    expect(infoSpy).toHaveBeenCalledWith(
      '[transactions.ui][stage=update_verification]',
      { transaction_id: 'txn-1', stage: 'update_verification', verified: true },
    );
    expect(mockInvalidateTransactions).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId('menu-action-edit'));
    expect(infoSpy).toHaveBeenCalledWith(
      '[transactions.ui][stage=navigate_edit]',
      { transaction_id: 'txn-1', stage: 'navigate_edit' },
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(drawer)/transaction',
      params: { id: 'txn-1' },
    });

    infoSpy.mockRestore();
  });

  it('confirms then soft deletes, logging structured stages and invalidating after success', async () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    const screen = await render(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('menu-action-delete'));

    await waitFor(() => expect(mockSoftDeleteTransaction).toHaveBeenCalledWith('txn-1'));
    expect(mockShowConfirmDialog).toHaveBeenCalledWith(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
    );
    expect(infoSpy).toHaveBeenCalledWith(
      '[transactions.ui][stage=soft_delete]',
      { transaction_id: 'txn-1', stage: 'soft_delete' },
    );
    expect(infoSpy.mock.invocationCallOrder[0]).toBeLessThan(mockSoftDeleteTransaction.mock.invocationCallOrder[0]);
    expect(mockInvalidateTransactionsAndTemplates).toHaveBeenCalledTimes(1);
    expect(mockSoftDeleteTransaction.mock.invocationCallOrder[0]).toBeLessThan(mockInvalidateTransactionsAndTemplates.mock.invocationCallOrder[0]);

    infoSpy.mockRestore();
  });

  it('treats a false soft delete result as a failed deletion', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockSoftDeleteTransaction.mockResolvedValueOnce(false);

    const screen = await render(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('menu-action-delete'));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith(
      '[transactions.ui][stage=soft_delete] failed',
      { transaction_id: 'txn-1', stage: 'soft_delete', reason: 'not_deleted' },
    ));
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to delete transaction');
    expect(mockInvalidateTransactionsAndTemplates).not.toHaveBeenCalled();

    alertSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('logs soft delete failures with stage metadata', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockSoftDeleteTransaction.mockRejectedValueOnce(new Error('delete failed'));

    const screen = await render(<HomeScreen />);
    await fireEvent.press(screen.getByTestId('menu-action-delete'));

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith(
      '[transactions.ui][stage=soft_delete] failed',
      { transaction_id: 'txn-1', stage: 'soft_delete', error: 'Error: delete failed' },
    ));
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Failed to delete transaction');
    expect(mockInvalidateTransactionsAndTemplates).not.toHaveBeenCalled();

    alertSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
