import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ExpenseFilterBar } from '../expense-filter-bar';

describe('ExpenseFilterBar', () => {
  it('exposes search and selects all-history range', async () => {
    const onSearchChange = jest.fn();
    const onPresetChange = jest.fn();
    const screen = await render(
      <ExpenseFilterBar
        search=""
        preset="monthly"
        onSearchChange={onSearchChange}
        onPresetChange={onPresetChange}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText('Search expenses'), 'coffee');
    await fireEvent.press(screen.getByRole('button', { name: 'All history' }));

    expect(onSearchChange).toHaveBeenCalledWith('coffee');
    expect(onPresetChange).toHaveBeenCalledWith('all');
  });

  it('can render date controls without transaction-only search or category controls', async () => {
    const screen = await render(
      <ExpenseFilterBar
        preset="monthly"
        onPresetChange={jest.fn()}
        showSearch={false}
        showCategories={false}
        categories={['Food']}
      />,
    );

    expect(screen.queryByLabelText('Search expenses')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Filter Food' })).toBeNull();
    expect(screen.getByRole('button', { name: 'This month' })).toBeTruthy();
  });
});
