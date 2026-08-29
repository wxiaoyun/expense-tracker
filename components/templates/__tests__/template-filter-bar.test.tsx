import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { TemplateFilterBar } from '../template-filter-bar';

describe('TemplateFilterBar', () => {
  it('emits exact search, type, and category filters', async () => {
    const onSearchChange = jest.fn();
    const onTypeChange = jest.fn();
    const onCategoriesChange = jest.fn();
    const screen = await render(
      <TemplateFilterBar
        search=""
        type="all"
        onSearchChange={onSearchChange}
        onTypeChange={onTypeChange}
        categories={['Food', 'Travel']}
        selectedCategories={[]}
        onCategoriesChange={onCategoriesChange}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText('Search templates'), 'coffee');
    await fireEvent.press(screen.getByRole('button', { name: 'Manual' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Scheduled' }));
    await fireEvent.press(screen.getByRole('button', { name: 'All' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Filter Food' }));

    expect(onSearchChange).toHaveBeenCalledWith('coffee');
    expect(onTypeChange.mock.calls).toEqual([['manual'], ['scheduled'], ['all']]);
    expect(onCategoriesChange).toHaveBeenCalledWith(['Food']);
  });

  it('removes a selected category without changing the others', async () => {
    const onCategoriesChange = jest.fn();
    const screen = await render(
      <TemplateFilterBar
        search=""
        type="all"
        onSearchChange={jest.fn()}
        onTypeChange={jest.fn()}
        categories={['Food', 'Travel']}
        selectedCategories={['Food', 'Travel']}
        onCategoriesChange={onCategoriesChange}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Filter Food' }));

    expect(onCategoriesChange).toHaveBeenCalledWith(['Travel']);
  });
});
