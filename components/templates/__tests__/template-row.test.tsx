import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { TransactionTemplate } from '@/db/schema';
import { TemplateRow } from '../template-row';

jest.mock('@/libs/intl', () => ({ formatCurrency: (amount: number) => `$${amount.toFixed(2)}` }));

jest.mock('@expo/ui/community/menu', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    MenuView: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
  };
});

const makeTemplate = (overrides: Partial<TransactionTemplate> = {}): TransactionTemplate => ({
  id: 'template-1',
  name: 'Coffee',
  normalizedName: 'coffee',
  amount: 5,
  transactionType: 'expense',
  description: 'Morning coffee',
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

const callbacks = () => ({
  onUse: jest.fn(),
  onQuickAdd: jest.fn(),
  onEdit: jest.fn(),
  onPause: jest.fn(),
  onResume: jest.fn(),
  onDelete: jest.fn(),
});

describe('TemplateRow', () => {
  it('uses a complete template card and exposes Quick Add', async () => {
    const props = callbacks();
    const screen = await render(<TemplateRow template={makeTemplate()} {...props} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Use Coffee' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Quick add Coffee' }));

    expect(props.onUse).toHaveBeenCalledWith('template-1');
    expect(props.onQuickAdd).toHaveBeenCalledWith('template-1');
    expect(screen.getByText('Manual')).toBeTruthy();
  });

  it('omits Quick Add for a partial template', async () => {
    const screen = await render(
      <TemplateRow template={makeTemplate({ amount: null })} {...callbacks()} />,
    );

    expect(screen.queryByRole('button', { name: 'Quick add Coffee' })).toBeNull();
  });

  it('keeps Quick Add and shows Paused for a paused scheduled template', async () => {
    const screen = await render(
      <TemplateRow
        template={makeTemplate({
          recurrenceValue: '0 0 1 * *',
          startDate: Date.UTC(2026, 0, 1),
          scheduleCursorAt: Date.UTC(2026, 0, 1),
          scheduleActive: 0,
        })}
        {...callbacks()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Quick add Coffee' })).toBeTruthy();
    expect(screen.getByText('Paused')).toBeTruthy();
  });

  it('disables only a pending Quick Add action', async () => {
    const props = callbacks();
    const screen = await render(
      <TemplateRow template={makeTemplate()} quickAddPending {...props} />,
    );

    const quickAdd = screen.getByRole('button', { name: 'Quick add Coffee' });
    expect(quickAdd.props.accessibilityState).toEqual({ disabled: true });
    await fireEvent.press(quickAdd);
    await fireEvent.press(screen.getByRole('button', { name: 'Use Coffee' }));

    expect(props.onQuickAdd).not.toHaveBeenCalled();
    expect(props.onUse).toHaveBeenCalledWith('template-1');
  });
});
