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
});
