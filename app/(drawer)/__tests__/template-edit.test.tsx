import React from 'react';
import { Alert, InteractionManager } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import type { TransactionTemplate } from '@/db/schema';
import type { TemplateDraft, TemplateSuggestion } from '@/db/template-core';
import TemplateEditDrawer from '../template-edit';

const mockInputFocus = jest.fn();

jest.mock('react-native', () => {
  const React = jest.requireActual('react');
  const native = jest.requireActual('react-native');
  const MockTextInput = React.forwardRef((props: { accessibilityLabel?: string }, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      focus: () => mockInputFocus(props.accessibilityLabel),
    }), [props.accessibilityLabel]);
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
const mockParams: { id?: string; sourceTransactionId?: string } = {};
const mockInvalidateQueries = jest.fn();
const mockGetTemplate = jest.fn();
const mockGetTransaction = jest.fn();
const mockCreateTemplate = jest.fn();
const mockUpdateTemplate = jest.fn();
const mockBackfillTemplate = jest.fn();
const mockPreviewTemplateBackfill = jest.fn();
const mockListSuggestions = jest.fn();
const mockNextName = jest.fn();
const mockCategoryRows = jest.fn();

jest.mock('expo-router', () => ({
  router: { dismiss: (...args: unknown[]) => mockDismiss(...args) },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args) }),
}));

jest.mock('@/hooks/useTemplatesQuery', () => ({
  useTemplateSuggestionsQuery: (_lookback: unknown, enabled: boolean) => ({
    data: enabled ? mockListSuggestions() : undefined,
    error: null,
  }),
}));

jest.mock('@/db/template', () => ({
  getTemplate: (...args: unknown[]) => mockGetTemplate(...args),
  createTemplate: (...args: unknown[]) => mockCreateTemplate(...args),
  updateTemplate: (...args: unknown[]) => mockUpdateTemplate(...args),
  backfillTemplate: (...args: unknown[]) => mockBackfillTemplate(...args),
  previewTemplateBackfill: (...args: unknown[]) => mockPreviewTemplateBackfill(...args),
  getNextAvailableTemplateName: (...args: unknown[]) => mockNextName(...args),
}));

jest.mock('@/db/transaction', () => ({
  getTransaction: (...args: unknown[]) => mockGetTransaction(...args),
  listCategoriesByUsage: (...args: unknown[]) => mockCategoryRows(...args),
}));

jest.mock('@expo/ui/community/datetime-picker', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text } = jest.requireActual('react-native');
  const MockDatePicker = ({ value, onValueChange, testID }: {
    value: Date;
    onValueChange: (event: unknown, date: Date) => void;
    testID: string;
  }) => React.createElement(
    Pressable,
    {
      accessibilityRole: 'button',
      testID,
      onPress: () => onValueChange({}, new Date('2025-01-01T00:00:00.000Z')),
    },
    React.createElement(Text, null, value.toISOString()),
  );
  return { DateTimePicker: MockDatePicker };
});

const draft = (overrides: Partial<TemplateDraft> = {}): TemplateDraft => ({
  name: 'Coffee',
  amount: 5,
  transactionType: 'expense',
  description: 'Coffee',
  category: 'Food',
  notes: null,
  verified: false,
  recurrenceValue: null,
  startDate: null,
  scheduleCursorAt: null,
  scheduleActive: false,
  ...overrides,
});

const template = (overrides: Partial<TransactionTemplate> = {}): TransactionTemplate => {
  const base = draft();
  return {
    ...base,
    id: 'template-1',
    normalizedName: 'coffee',
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    verified: base.verified ? 1 : 0,
    scheduleActive: base.scheduleActive ? 1 : 0,
    ...overrides,
  };
};

const suggestion = (name: string): TemplateSuggestion => ({
  ...draft({ name, description: name, amount: 12 }),
  count: 3,
  mostRecentAt: 100,
});

const fillRequiredFields = async (screen: Awaited<ReturnType<typeof render>>) => {
  await waitFor(() => expect(screen.getByLabelText('Template name')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('Template name'), 'Rent');
  await fireEvent.changeText(screen.getByLabelText('Template amount'), '100');
  await fireEvent.changeText(screen.getByLabelText('Template description'), 'Rent');
};

describe('TemplateEditDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete mockParams.id;
    delete mockParams.sourceTransactionId;
    mockCategoryRows.mockResolvedValue([]);
    mockListSuggestions.mockReturnValue([]);
    mockGetTemplate.mockResolvedValue(null);
    mockGetTransaction.mockResolvedValue(null);
    mockCreateTemplate.mockImplementation(async (value: TemplateDraft) => template({
      ...value,
      id: 'created-1',
      verified: value.verified ? 1 : 0,
      scheduleActive: value.scheduleActive ? 1 : 0,
    }));
    mockUpdateTemplate.mockImplementation(async (id: string, value: TemplateDraft) => template({
      ...value,
      id,
      verified: value.verified ? 1 : 0,
      scheduleActive: value.scheduleActive ? 1 : 0,
    }));
    mockBackfillTemplate.mockResolvedValue(0);
    mockPreviewTemplateBackfill.mockResolvedValue(0);
    mockNextName.mockResolvedValue('Coffee 2');
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blank creation focuses amount after presentation and displays no more than five suggestions', async () => {
    mockListSuggestions.mockReturnValue(Array.from({ length: 7 }, (_, index) => suggestion(`Suggestion ${index + 1}`)));
    let scheduledFocus: (() => unknown) | undefined;
    const interactionSpy = jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((task) => {
      scheduledFocus = typeof task === 'function' ? task : task?.gen;
      return { then: jest.fn(), done: jest.fn(), cancel: jest.fn() };
    });
    const screen = await render(<TemplateEditDrawer />);

    await waitFor(() => expect(screen.getByText('Suggestion 5')).toBeTruthy());
    expect(screen.queryByText('Suggestion 6')).toBeNull();
    expect(interactionSpy).toHaveBeenCalledTimes(1);
    await act(() => scheduledFocus?.());
    expect(mockInputFocus).toHaveBeenCalledTimes(1);
    expect(mockInputFocus).toHaveBeenCalledWith('Template amount');
  });

  it('selecting a suggestion populates fields without saving', async () => {
    mockListSuggestions.mockReturnValue([suggestion('Train pass')]);
    const screen = await render(<TemplateEditDrawer />);
    await waitFor(() => screen.getByText('Train pass'));

    await fireEvent.press(screen.getByRole('button', { name: 'Use suggestion Train pass' }));

    expect(screen.getByLabelText('Template name')).toHaveProp('value', 'Train pass');
    expect(screen.getByLabelText('Template amount')).toHaveProp('value', '12');
    expect(screen.getByLabelText('Template description')).toHaveProp('value', 'Train pass');
    expect(mockCreateTemplate).not.toHaveBeenCalled();
  });

  it('edit mode loads an existing template and does not autofocus', async () => {
    mockParams.id = 'template-1';
    mockGetTemplate.mockResolvedValue(template({ name: 'Edited coffee', amount: 8 }));
    const interactionSpy = jest.spyOn(InteractionManager, 'runAfterInteractions');
    const screen = await render(<TemplateEditDrawer />);

    await waitFor(() => expect(screen.getByLabelText('Template name')).toHaveProp('value', 'Edited coffee'));
    expect(screen.getByLabelText('Template amount')).toHaveProp('value', '8');
    expect(mockInputFocus).not.toHaveBeenCalled();
    expect(interactionSpy).not.toHaveBeenCalled();
    expect(mockListSuggestions).not.toHaveBeenCalled();
  });

  it('prefers edit id without merging when both route sources are present', async () => {
    mockParams.id = 'template-1';
    mockParams.sourceTransactionId = 'transaction-1';
    mockGetTemplate.mockResolvedValue(template({ name: 'Edit wins' }));
    const errorSpy = jest.spyOn(console, 'error');

    const screen = await render(<TemplateEditDrawer />);

    await waitFor(() => expect(screen.getByLabelText('Template name')).toHaveProp('value', 'Edit wins'));
    expect(mockGetTemplate).toHaveBeenCalledWith('template-1');
    expect(mockGetTransaction).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      '[templates.editor][stage=resolve_source] failed',
      {
        template_id_present: true,
        source_transaction_id_present: true,
        stage: 'resolve_source',
        error: 'Conflicting route sources',
      },
    );
  });

  it('source transaction populates name and transaction values, omits date, and hides suggestions', async () => {
    mockParams.sourceTransactionId = 'transaction-1';
    const interactionSpy = jest.spyOn(InteractionManager, 'runAfterInteractions');
    mockGetTransaction.mockResolvedValue({
      id: 'transaction-1',
      amount: 42,
      transactionDate: new Date('2020-01-02').getTime(),
      description: 'Salary',
      category: 'Income',
      notes: 'Monthly',
      verified: 1,
    });
    const screen = await render(<TemplateEditDrawer />);

    await waitFor(() => expect(screen.getByLabelText('Template name')).toHaveProp('value', 'Salary'));
    expect(screen.getByLabelText('Template amount')).toHaveProp('value', '42');
    expect(screen.getByRole('button', { name: 'Transaction type: Income' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.queryByText('2020')).toBeNull();
    expect(mockInputFocus).not.toHaveBeenCalled();
    expect(mockListSuggestions).not.toHaveBeenCalled();
    expect(interactionSpy).not.toHaveBeenCalled();
  });

  it('shows a zero amount error only after Save', async () => {
    const screen = await render(<TemplateEditDrawer />);
    await fireEvent.changeText(screen.getByLabelText('Template name'), 'Free item');
    await fireEvent.changeText(screen.getByLabelText('Template amount'), '0');

    expect(screen.queryByText('Amount must be greater than zero')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Amount must be greater than zero')).toBeTruthy();
  });

  it('keeps invalid cron preview safe and only shows validation after Save', async () => {
    const screen = await render(<TemplateEditDrawer />);
    await fillRequiredFields(screen);
    await fireEvent(screen.getByRole('switch', { name: 'Repeat automatically' }), 'valueChange', true);
    await fireEvent.changeText(screen.getByLabelText('Cron expression'), 'not a cron');

    expect(screen.queryByText('Invalid cron expression')).toBeNull();
    expect(screen.queryAllByTestId('next-occurrence')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Invalid cron expression')).toBeTruthy();
  });

  it('shows duplicate normalized name inline with an actionable suffix', async () => {
    mockCreateTemplate.mockRejectedValueOnce(new Error('Template name already exists'));
    const screen = await render(<TemplateEditDrawer />);
    await fillRequiredFields(screen);

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('Template name already exists')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Use suggested name Coffee 2' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Use suggested name Coffee 2' }));
    expect(screen.getByLabelText('Template name')).toHaveProp('value', 'Coffee 2');
    expect(mockCreateTemplate).toHaveBeenCalledTimes(1);
  });

  it('Repeat automatically reveals presets, raw cron, start date, and the next three dates', async () => {
    const screen = await render(<TemplateEditDrawer />);
    await fillRequiredFields(screen);
    await fireEvent(screen.getByRole('switch', { name: 'Repeat automatically' }), 'valueChange', true);

    expect(screen.getByRole('button', { name: 'Recurrence preset Daily' })).toBeTruthy();
    expect(screen.getByLabelText('Cron expression')).toBeTruthy();
    expect(screen.getByTestId('template-start-date')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTestId('next-occurrence')).toHaveLength(3));
  });

  it('requires confirmation before disabling repetition on a scheduled template', async () => {
    mockParams.id = 'template-1';
    mockGetTemplate.mockResolvedValue(template({
      recurrenceValue: '0 0 1 * *',
      startDate: Date.now(),
      scheduleCursorAt: Date.now(),
      scheduleActive: 1,
    }));
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<TemplateEditDrawer />);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Repeat automatically' }).props.value).toBe(true));

    await fireEvent(screen.getByRole('switch', { name: 'Repeat automatically' }), 'valueChange', false);

    expect(alertSpy).toHaveBeenCalledWith(
      'Stop repeating?',
      expect.stringContaining('clear'),
      expect.any(Array),
    );
    expect(screen.getByRole('switch', { name: 'Repeat automatically' }).props.value).toBe(true);
    const buttons = alertSpy.mock.calls[0][2]!;
    await act(() => buttons[1].onPress?.());
    expect(screen.getByRole('switch', { name: 'Repeat automatically' }).props.value).toBe(false);
  });

  it('updates other fields while activating an inactive edited schedule', async () => {
    mockParams.id = 'template-1';
    mockGetTemplate.mockResolvedValue(template({
      recurrenceValue: '0 0 1 * *',
      startDate: Date.now(),
      scheduleCursorAt: 10,
      scheduleActive: 0,
    }));
    const screen = await render(<TemplateEditDrawer />);
    await waitFor(() => expect(screen.getByLabelText('Template name')).toHaveProp('value', 'Coffee'));

    await fireEvent.changeText(screen.getByLabelText('Template name'), 'Activated coffee');
    await fireEvent(screen.getByRole('switch', { name: 'Schedule active' }), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockUpdateTemplate).toHaveBeenCalledWith(
      'template-1',
      expect.objectContaining({ name: 'Activated coffee', scheduleActive: true }),
    ));
  });

  it('keeps an active saved template and explains launch retry when backfill fails', async () => {
    mockPreviewTemplateBackfill.mockResolvedValue(2);
    mockBackfillTemplate.mockRejectedValue(new Error('backfill unavailable'));
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<TemplateEditDrawer />);
    await fillRequiredFields(screen);
    await fireEvent(screen.getByRole('switch', { name: 'Repeat automatically' }), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('template-start-date'));
    await waitFor(() => screen.getByText('Saving will create 2 past transactions.'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Create 2 past transactions?',
      expect.any(String),
      expect.any(Array),
    ));

    const confirmation = alertSpy.mock.calls.find((call) => call[0] === 'Create 2 past transactions?')!;
    await act(async () => confirmation[2]![1].onPress?.());

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Template saved, backfill failed',
      'The template was saved. Historical transactions were not added. Launch-time processing will retry automatically.',
    ));
    expect(mockCreateTemplate).toHaveBeenCalledTimes(1);
    expect(mockDismiss).toHaveBeenCalled();
  });

  it('confirms and completes explicit backfill for an inactive schedule', async () => {
    mockPreviewTemplateBackfill.mockResolvedValue(2);
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<TemplateEditDrawer />);
    await fillRequiredFields(screen);
    await fireEvent(screen.getByRole('switch', { name: 'Repeat automatically' }), 'valueChange', true);
    await fireEvent(screen.getByRole('switch', { name: 'Schedule active' }), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('template-start-date'));
    await waitFor(() => screen.getByText('Saving will create 2 past transactions.'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Create 2 past transactions?',
      expect.any(String),
      expect.any(Array),
    ));

    const confirmation = alertSpy.mock.calls.find((call) => call[0] === 'Create 2 past transactions?')!;
    await act(async () => confirmation[2]![1].onPress?.());

    await waitFor(() => expect(mockBackfillTemplate).toHaveBeenCalledWith('created-1', expect.any(Number)));
    expect(mockCreateTemplate).toHaveBeenCalledWith(expect.objectContaining({ scheduleActive: false }));
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalledWith('Template saved, backfill failed', expect.any(String));
  });

  it('explains that inactive schedules do not retry automatically after backfill failure', async () => {
    mockPreviewTemplateBackfill.mockResolvedValue(2);
    mockBackfillTemplate.mockRejectedValue(new Error('backfill unavailable'));
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<TemplateEditDrawer />);
    await fillRequiredFields(screen);
    await fireEvent(screen.getByRole('switch', { name: 'Repeat automatically' }), 'valueChange', true);
    await fireEvent(screen.getByRole('switch', { name: 'Schedule active' }), 'valueChange', false);
    await fireEvent.press(screen.getByTestId('template-start-date'));
    await waitFor(() => screen.getByText('Saving will create 2 past transactions.'));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Create 2 past transactions?',
      expect.any(String),
      expect.any(Array),
    ));

    const confirmation = alertSpy.mock.calls.find((call) => call[0] === 'Create 2 past transactions?')!;
    await act(async () => confirmation[2]![1].onPress?.());

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Template saved, backfill failed',
      'The template was saved. Historical transactions were not added. Inactive schedules do not retry automatically.',
    ));
  });

  it('previews and confirms the exact past-start backfill count before save', async () => {
    mockPreviewTemplateBackfill.mockResolvedValue(7);
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<TemplateEditDrawer />);
    await fillRequiredFields(screen);
    await fireEvent(screen.getByRole('switch', { name: 'Repeat automatically' }), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('template-start-date'));

    await waitFor(() => expect(screen.getByText('Saving will create 7 past transactions.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Create 7 past transactions?',
      expect.stringContaining('exactly 7'),
      expect.any(Array),
    ));
    expect(mockCreateTemplate).not.toHaveBeenCalled();

    const buttons = alertSpy.mock.calls[0][2]!;
    await act(async () => buttons[1].onPress?.());
    await waitFor(() => expect(mockCreateTemplate).toHaveBeenCalled());
    const submissionPreviewCall = mockPreviewTemplateBackfill.mock.calls.find((call) => call.length === 2);
    expect(submissionPreviewCall).toEqual([expect.any(Object), expect.any(Number)]);
    expect(mockBackfillTemplate).toHaveBeenCalledWith('created-1', submissionPreviewCall![1]);
  });

  it('guards preview and confirmation against a double-tap', async () => {
    mockPreviewTemplateBackfill.mockResolvedValue(2);
    const alertSpy = jest.spyOn(Alert, 'alert');
    const screen = await render(<TemplateEditDrawer />);
    await fillRequiredFields(screen);
    await fireEvent(screen.getByRole('switch', { name: 'Repeat automatically' }), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('template-start-date'));
    await waitFor(() => screen.getByText('Saving will create 2 past transactions.'));
    mockPreviewTemplateBackfill.mockClear();

    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Create 2 past transactions?',
      expect.any(String),
      expect.any(Array),
    ));
    expect(mockPreviewTemplateBackfill).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProp('accessibilityState', { disabled: true });
    expect(mockCreateTemplate).not.toHaveBeenCalled();

    const confirmation = alertSpy.mock.calls.find((call) => call[0] === 'Create 2 past transactions?')!;
    await act(async () => confirmation[2]![1].onPress?.());
    await waitFor(() => {
      expect(mockCreateTemplate).toHaveBeenCalledTimes(1);
      expect(mockBackfillTemplate).toHaveBeenCalledTimes(1);
      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });
    expect(mockPreviewTemplateBackfill).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls.filter((call) => call[0] === 'Create 2 past transactions?')).toHaveLength(1);
  });
});
