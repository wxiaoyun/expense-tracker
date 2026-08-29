import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AddTemplateButton } from '../add-template-button';

const mockPush = jest.fn();

jest.mock('sonner-native', () => ({ toast: { error: jest.fn() } }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe('AddTemplateButton', () => {
  beforeEach(() => mockPush.mockClear());

  it('opens a new template editor when pressed', async () => {
    const screen = await render(<AddTemplateButton />);

    await fireEvent.press(screen.getByRole('button', { name: 'Add template' }));

    expect(mockPush).toHaveBeenCalledWith('/(drawer)/template-edit');
  });
});
