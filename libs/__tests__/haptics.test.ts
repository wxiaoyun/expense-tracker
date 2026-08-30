const mockImpactAsync = jest.fn();
const mockNotificationAsync = jest.fn();
const mockSelectionAsync = jest.fn();

jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  notificationAsync: (...args: unknown[]) => mockNotificationAsync(...args),
  selectionAsync: (...args: unknown[]) => mockSelectionAsync(...args),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: {
    Error: 'error',
    Success: 'success',
    Warning: 'warning',
  },
}));

import { Platform } from 'react-native';

import {
  actionFeedback,
  errorFeedback,
  selectionFeedback,
  successFeedback,
  warningFeedback,
} from '@/libs/haptics';

describe('haptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockImpactAsync.mockResolvedValue(undefined);
    mockNotificationAsync.mockResolvedValue(undefined);
    mockSelectionAsync.mockResolvedValue(undefined);
  });

  it('maps app feedback to iOS haptic semantics', async () => {
    selectionFeedback();
    actionFeedback();
    successFeedback();
    warningFeedback();
    errorFeedback();
    await Promise.resolve();

    expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith('medium');
    expect(mockNotificationAsync).toHaveBeenNthCalledWith(1, 'success');
    expect(mockNotificationAsync).toHaveBeenNthCalledWith(2, 'warning');
    expect(mockNotificationAsync).toHaveBeenNthCalledWith(3, 'error');
  });

  it('does nothing outside iOS', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

    selectionFeedback();
    actionFeedback();
    successFeedback();

    expect(mockSelectionAsync).not.toHaveBeenCalled();
    expect(mockImpactAsync).not.toHaveBeenCalled();
    expect(mockNotificationAsync).not.toHaveBeenCalled();
  });

  it('logs and swallows native haptic failures', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockSelectionAsync.mockRejectedValueOnce(new Error('unavailable'));

    expect(() => selectionFeedback()).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).toHaveBeenCalledWith(
      '[haptics][stage=trigger] failed',
      expect.objectContaining({
        stage: 'trigger',
        feedback: 'selection',
        error: 'Error: unavailable',
      }),
    );
    error.mockRestore();
  });
});
