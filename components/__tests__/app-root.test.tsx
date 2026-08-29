import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { AppRoot } from '../app-root';

jest.mock('sonner-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text: MockText } = require('react-native');
  return {
    Toaster: ({ position }: { position: string }) => <MockText testID="global-toaster">{position}</MockText>,
  };
});

describe('AppRoot', () => {
  it('renders gesture-enabled application content', async () => {
    const screen = await render(
      <AppRoot>
        <Text>Expense list</Text>
      </AppRoot>,
    );

    expect(screen.getByText('Expense list')).toBeTruthy();
    expect(screen.getByTestId('global-toaster')).toHaveTextContent('top-center');
  });
});
