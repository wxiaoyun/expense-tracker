import { useColorScheme } from 'react-native';

import { useThemeColor, useThemeColors } from '../useThemeColor';

jest.mock('react-native', () => ({ useColorScheme: jest.fn() }));

const mockUseColorScheme = jest.mocked(useColorScheme);

describe('theme colors', () => {
  it('returns light semantic colors for light appearance', () => {
    mockUseColorScheme.mockReturnValue('light');

    expect(useThemeColors()).toMatchObject({
      background: '#FFFFFF',
      groupedBackground: '#F2F2F7',
      text: '#000000',
      onPrimary: '#FFFFFF',
      separator: '#8E8E93',
      overlay: 'rgba(242,242,247,0.86)',
    });
  });

  it('returns dark semantic colors for dark appearance', () => {
    mockUseColorScheme.mockReturnValue('dark');

    expect(useThemeColor('background')).toBe('#000000');
    expect(useThemeColors()).toMatchObject({
      groupedBackground: '#1C1C1E',
      surface: '#1C1C1E',
      text: '#FFFFFF',
      onPrimary: '#000000',
      separator: '#68686D',
      overlay: 'rgba(28,28,30,0.86)',
    });
  });
});
