import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

import type { TransactionTemplate } from '@/db/schema';
import TemplatesScreen from '../../../app/(tabs)/templates';

const mockUseTemplateListQuery = jest.fn();
const mockUseCategoryQuery = jest.fn();
const mockMutation = { mutateAsync: jest.fn() };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('sonner-native', () => ({
  Toaster: () => null,
  toast: { error: jest.fn(), success: jest.fn() },
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => mockUseCategoryQuery(),
}));

jest.mock('@/db/transaction', () => ({
  listCategories: jest.fn(),
}));

jest.mock('@/hooks/useTemplatesQuery', () => ({
  queryKeys: { categories: { list: () => ['categories', 'list'] } },
  useTemplateListQuery: (...args: unknown[]) => mockUseTemplateListQuery(...args),
  useDeleteTemplateMutation: () => mockMutation,
  usePauseTemplateMutation: () => mockMutation,
  useQuickAddTemplateMutation: () => mockMutation,
  useResumeTemplateMutation: () => mockMutation,
  useUndoQuickAddMutation: () => mockMutation,
}));

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

jest.mock('../template-filter-bar', () => ({
  TemplateFilterBar: () => null,
}));

jest.mock('../add-template-button', () => ({
  AddTemplateButton: () => null,
}));

const staleTemplate = {
  id: 'template-1',
  name: 'Coffee',
} as TransactionTemplate;

describe('TemplatesScreen query failures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('owns query errors and logs each stage once', async () => {
    const templateError = new Error('template database unavailable');
    const categoryError = new Error('category database unavailable');
    mockUseTemplateListQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: templateError,
    });
    mockUseCategoryQuery.mockReturnValue({
      data: undefined,
      error: categoryError,
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const screen = await render(<TemplatesScreen />);

    expect(screen.getByText('Could not load templates')).toBeTruthy();
    expect(screen.getByText('template database unavailable')).toBeTruthy();
    expect(screen.getByText('Could not load template categories')).toBeTruthy();
    expect(screen.getByText('category database unavailable')).toBeTruthy();
    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        '[templates.ui][stage=load_templates] failed',
        {
          template_id: null,
          stage: 'load_templates',
          error: 'Error: template database unavailable',
        },
      );
      expect(errorSpy).toHaveBeenCalledWith(
        '[templates.ui][stage=load_categories] failed',
        {
          template_id: null,
          stage: 'load_categories',
          error: 'Error: category database unavailable',
        },
      );
    });

    screen.rerender(<TemplatesScreen />);
    await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(2));
  });

  it('does not render an empty state for an initial template query failure', async () => {
    const templateError = new Error('template database unavailable');
    mockUseTemplateListQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: templateError,
    });
    mockUseCategoryQuery.mockReturnValue({ data: [], error: null });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const screen = await render(<TemplatesScreen />);

    expect(screen.getByText('Could not load templates')).toBeTruthy();
    expect(screen.queryByText('No Templates Yet')).toBeNull();
  });

  it('keeps stale template rows visible when a refetch fails', async () => {
    const templateError = new Error('template refresh unavailable');
    mockUseTemplateListQuery.mockReturnValue({
      data: [staleTemplate],
      isLoading: false,
      error: templateError,
    });
    mockUseCategoryQuery.mockReturnValue({ data: [], error: null });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const screen = await render(<TemplatesScreen />);

    expect(screen.getByText('Could not load templates')).toBeTruthy();
    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.queryByText('No Templates Yet')).toBeNull();
  });
});
