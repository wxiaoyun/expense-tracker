import React from 'react';
import { render } from '@testing-library/react-native';

import type { TransactionTemplate } from '@/db/schema';
import { TemplateList } from '../template-list';

jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    FlashList: ({ data, renderItem }: { data: unknown[]; renderItem: (info: { item: unknown }) => React.ReactNode }) =>
      React.createElement(View, null, data.map((item, index) => React.createElement(
        React.Fragment,
        { key: index },
        renderItem({ item }),
      ))),
  };
});

jest.mock('../template-row', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    TemplateRow: ({ template }: { template: TransactionTemplate }) => React.createElement(Text, null, template.name),
  };
});

const callbacks = {
  onUse: jest.fn(),
  onQuickAdd: jest.fn(),
  onEdit: jest.fn(),
  onPause: jest.fn(),
  onResume: jest.fn(),
  onDelete: jest.fn(),
};

const template = {
  id: 'template-1',
  name: 'Coffee',
} as TransactionTemplate;

describe('TemplateList', () => {
  it('owns its loading state', async () => {
    const screen = await render(<TemplateList templates={[]} isLoading {...callbacks} />);

    expect(screen.getByText('Loading templates…')).toBeTruthy();
  });

  it('owns its empty state', async () => {
    const screen = await render(<TemplateList templates={[]} {...callbacks} />);

    expect(screen.getByText('No Templates Yet')).toBeTruthy();
  });

  it('renders template rows', async () => {
    const screen = await render(<TemplateList templates={[template]} {...callbacks} />);

    expect(screen.getByText('Coffee')).toBeTruthy();
  });
});
