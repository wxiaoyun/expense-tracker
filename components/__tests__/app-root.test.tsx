import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { AppRoot } from '../app-root';

describe('AppRoot', () => {
  it('renders gesture-enabled application content', async () => {
    const screen = await render(
      <AppRoot>
        <Text>Expense list</Text>
      </AppRoot>,
    );

    expect(screen.getByText('Expense list')).toBeTruthy();
  });
});
