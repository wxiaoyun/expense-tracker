import React from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { TransactionTemplate } from '@/db/schema';
import TransactionDrawer from '../transaction';

const mockAmountRef = { focus: jest.fn() };
const mockDescriptionRef = { focus: jest.fn() };

jest.mock('react-native', () => {
  const React = jest.requireActual('react');
  const native = jest.requireActual('react-native');
  const MockTextInput = React.forwardRef((props: { accessibilityLabel?: string; autoFocus?: boolean }, ref: React.Ref<unknown>) => {
    const focus = React.useCallback(() => {
      if (props.accessibilityLabel === 'Amount') mockAmountRef.focus();
      if (props.accessibilityLabel === 'Description') mockDescriptionRef.focus();
    }, [props.accessibilityLabel]);
    React.useImperativeHandle(ref, () => ({ focus }), [focus]);
    React.useEffect(() => {
      if (props.autoFocus) focus();
    }, [focus, props.autoFocus]);
    return React.createElement(native.TextInput, props);
  });
  MockTextInput.displayName = 'MockTextInput';
  return new Proxy(native, {
    get(target, property, receiver) {
      return property === 'TextInput' ? MockTextInput : Reflect.get(target, property, receiver);
    },
  });
});

const mockDismiss = jest.fn();
const mockParams: { id?: string; templateId?: string } = {};
const mockGetTransaction = jest.fn();
const mockCreateTransaction = jest.fn();
const mockUpdateTransaction = jest.fn();
const mockGetTemplate = jest.fn();
const mockInvalidateTransactions = jest.fn();
const mockCategoryRows = jest.fn();

jest.mock('expo-router', () => ({
  router: { dismiss: (...args: unknown[]) => mockDismiss(...args) },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/hooks/useQueryClient', () => ({
  useInvalidateTransactionsAndTemplates: () => mockInvalidateTransactions,
}));

jest.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({ all: () => mockCategoryRows() }),
    }),
  },
}));

jest.mock('@/db/transaction', () => ({
  getTransaction: (...args: unknown[]) => mockGetTransaction(...args),
  createTransaction: (...args: unknown[]) => mockCreateTransaction(...args),
  updateTransaction: (...args: unknown[]) => mockUpdateTransaction(...args),
}));

jest.mock('@/db/template', () => ({
  getTemplate: (...args: unknown[]) => mockGetTemplate(...args),
}));

jest.mock('@expo/ui/community/datetime-picker', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  const MockDatePicker = ({ value, testID }: { value: Date; testID: string }) =>
    React.createElement(Text, { testID }, value.toISOString());
  return { DateTimePicker: MockDatePicker };
});

const template = (overrides: Partial<TransactionTemplate> = {}): TransactionTemplate => ({
  id: 'template-1',
  name: 'Coffee',
  normalizedName: 'coffee',
  amount: 5,
  transactionType: 'expense',
  description: 'Coffee beans',
  category: 'Groceries',
  notes: 'Grind fine',
  verified: 1,
  recurrenceValue: null,
  startDate: 111,
  scheduleCursorAt: 222,
  scheduleActive: 0,
  deletedAt: null,
  createdAt: 1,
  updatedAt: 2,
  ...overrides,
});

const transaction = (overrides: Record<string, unknown> = {}) => ({
  id: 'transaction-1',
  amount: -8,
  transactionDate: Date.parse('2025-01-01T00:00:00.000Z'),
  description: 'Existing',
  category: 'Other',
  templateId: null,
  verified: 0,
  notes: null,
  deletedAt: null,
  createdAt: 1,
  updatedAt: 2,
  ...overrides,
});

const renderDrawer = () => render(<TransactionDrawer />);

const flushFrame = async () => {
  const callback = requestAnimationFrameMock.mock.calls.at(-1)?.[0];
  if (callback) {
    await act(() => callback(0));
  }
};

let frameId = 0;
let requestAnimationFrameMock: jest.Mock<number, [FrameRequestCallback]>;
let cancelAnimationFrameMock: jest.Mock<void, [number | null | undefined]>;

describe('TransactionDrawer template population and focus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete mockParams.id;
    delete mockParams.templateId;
    mockCategoryRows.mockResolvedValue([]);
    mockGetTransaction.mockResolvedValue(null);
    mockGetTemplate.mockResolvedValue(null);
    mockCreateTransaction.mockResolvedValue(transaction({ id: 'created-1' }));
    mockUpdateTransaction.mockImplementation(async (value) => value);
    jest.useFakeTimers().setSystemTime(new Date('2026-08-29T12:34:56.000Z'));
    frameId = 0;
    requestAnimationFrameMock = jest.fn((callback: FrameRequestCallback) => {
      frameId += 1;
      return frameId;
    });
    cancelAnimationFrameMock = jest.fn();
    global.requestAnimationFrame = requestAnimationFrameMock;
    global.cancelAnimationFrame = cancelAnimationFrameMock;
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('blank creation focuses amount and does not focus description', async () => {
    await renderDrawer();

    await waitFor(() => expect(mockAmountRef.focus).toHaveBeenCalledTimes(1));
    expect(mockDescriptionRef.focus).not.toHaveBeenCalled();
    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
  });

  it('template missing amount focuses amount after lookup state is ready', async () => {
    mockParams.templateId = 'template-1';
    mockGetTemplate.mockResolvedValue(template({ amount: null, description: 'Coffee beans' }));
    const screen = await renderDrawer();

    await waitFor(() => expect(screen.getByLabelText('Description')).toHaveProp('value', 'Coffee beans'));
    expect(mockAmountRef.focus).not.toHaveBeenCalled();

    await flushFrame();

    expect(mockAmountRef.focus).toHaveBeenCalledTimes(1);
    expect(mockDescriptionRef.focus).not.toHaveBeenCalled();
  });

  it('template missing description focuses description when amount is present', async () => {
    mockParams.templateId = 'template-1';
    mockGetTemplate.mockResolvedValue(template({ amount: 12, description: null }));
    const screen = await renderDrawer();

    await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveProp('value', '12'));
    await flushFrame();

    expect(mockAmountRef.focus).not.toHaveBeenCalled();
    expect(mockDescriptionRef.focus).toHaveBeenCalledTimes(1);
  });

  it('cancels a scheduled template focus frame on unmount', async () => {
    mockParams.templateId = 'template-1';
    mockGetTemplate.mockResolvedValue(template({ amount: null, description: 'Coffee beans' }));
    const screen = await renderDrawer();

    await waitFor(() => expect(requestAnimationFrameMock).toHaveBeenCalledTimes(1));
    await act(() => screen.unmount());

    expect(cancelAnimationFrameMock).toHaveBeenCalledWith(1);
    expect(mockAmountRef.focus).not.toHaveBeenCalled();
    expect(mockDescriptionRef.focus).not.toHaveBeenCalled();
  });

  it('complete template keeps the keyboard closed', async () => {
    mockParams.templateId = 'template-1';
    mockGetTemplate.mockResolvedValue(template());
    const screen = await renderDrawer();

    await waitFor(() => expect(screen.getByLabelText('Description')).toHaveProp('value', 'Coffee beans'));
    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
    expect(mockAmountRef.focus).not.toHaveBeenCalled();
    expect(mockDescriptionRef.focus).not.toHaveBeenCalled();
  });

  it('edit mode keeps the keyboard closed and does not load a template', async () => {
    mockParams.id = 'transaction-1';
    mockGetTransaction.mockResolvedValue(transaction());
    const screen = await renderDrawer();

    await waitFor(() => expect(screen.getByLabelText('Description')).toHaveProp('value', 'Existing'));
    expect(mockGetTemplate).not.toHaveBeenCalled();
    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
    expect(mockAmountRef.focus).not.toHaveBeenCalled();
    expect(mockDescriptionRef.focus).not.toHaveBeenCalled();
  });

  it('populates template values, uses a fresh transaction date, and retains provenance on create', async () => {
    mockParams.templateId = 'template-1';
    mockGetTemplate.mockResolvedValue(template({ amount: 42, transactionType: 'income' }));
    const screen = await renderDrawer();

    await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveProp('value', '42'));
    expect(screen.getByRole('button', { name: 'Transaction type: Income' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText('Description')).toHaveProp('value', 'Coffee beans');
    expect(screen.getByLabelText('Custom category')).toHaveProp('value', 'Groceries');
    expect(screen.getByLabelText('Notes')).toHaveProp('value', 'Grind fine');

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockCreateTransaction).toHaveBeenCalledTimes(1));
    expect(mockCreateTransaction).toHaveBeenCalledWith(expect.objectContaining({
      amount: 42,
      transactionDate: Date.parse('2026-08-29T12:34:56.000Z'),
      description: 'Coffee beans',
      category: 'Groceries',
      notes: 'Grind fine',
      verified: 1,
      templateId: 'template-1',
      deletedAt: null,
    }));
    expect(mockInvalidateTransactions).toHaveBeenCalledTimes(1);
  });

  it('validates positive finite amount only on save and focuses amount on error', async () => {
    const screen = await renderDrawer();
    await waitFor(() => expect(mockAmountRef.focus).toHaveBeenCalledTimes(1));
    mockAmountRef.focus.mockClear();

    await fireEvent.changeText(screen.getByLabelText('Amount'), '0');
    await fireEvent.changeText(screen.getByLabelText('Description'), 'Free sample');
    expect(mockCreateTransaction).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('Amount must be greater than zero')).toBeTruthy());
    expect(mockCreateTransaction).not.toHaveBeenCalled();
    expect(mockAmountRef.focus).toHaveBeenCalledTimes(1);
  });

  it('shows Template not found and prevents create for missing templates without logging an error', async () => {
    mockParams.templateId = 'missing-template';
    mockGetTemplate.mockResolvedValue(null);
    const errorSpy = jest.spyOn(console, 'error');
    const infoSpy = jest.spyOn(console, 'info');
    const screen = await renderDrawer();

    await waitFor(() => expect(screen.getByText('Template not found')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(mockCreateTransaction).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      '[transaction.form][stage=load_template] skipped template population',
      expect.objectContaining({ template_id: 'missing-template', stage: 'load_template', reason: 'not_found' }),
    );
  });

  it('prefers edit id when id and templateId are both present and never applies template provenance to update', async () => {
    mockParams.id = 'transaction-1';
    mockParams.templateId = 'template-1';
    mockGetTransaction.mockResolvedValue(transaction({ templateId: null }));
    const errorSpy = jest.spyOn(console, 'error');
    const screen = await renderDrawer();

    await waitFor(() => expect(screen.getByLabelText('Description')).toHaveProp('value', 'Existing'));
    await fireEvent.changeText(screen.getByLabelText('Amount'), '9');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(mockGetTemplate).not.toHaveBeenCalled();
    await waitFor(() => expect(mockUpdateTransaction).toHaveBeenCalledWith(expect.objectContaining({ templateId: null })));
    expect(mockInvalidateTransactions).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '[transaction.form][stage=resolve_source] failed',
      {
        stage: 'resolve_source',
        transaction_id_present: true,
        template_id_present: true,
        error: 'Conflicting route sources',
      },
    );
  });
});
