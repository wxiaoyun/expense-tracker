import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AddExpenseButton } from '../add-expense-button';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('AddExpenseButton', () => {
  beforeEach(() => mockPush.mockClear());

  it('opens new transaction sheet when pressed', async () => {
    const screen = await render(<AddExpenseButton />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));

    expect(mockPush).toHaveBeenCalledWith('/(drawer)/transaction');
  });
});
