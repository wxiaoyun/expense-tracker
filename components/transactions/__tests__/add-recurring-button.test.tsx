import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AddRecurringButton } from '../add-recurring-button';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('AddRecurringButton', () => {
  beforeEach(() => mockPush.mockClear());

  it('opens new recurring transaction sheet', async () => {
    const screen = await render(<AddRecurringButton />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add recurring expense' }));

    expect(mockPush).toHaveBeenCalledWith('/(drawer)/recurring-edit');
  });
});
