import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type Feedback = 'action' | 'error' | 'selection' | 'success' | 'warning';

function trigger(feedback: Feedback, perform: () => Promise<void>): void {
  if (Platform.OS !== 'ios') return;

  console.info('[haptics][stage=trigger] triggering haptic feedback', {
    stage: 'trigger',
    feedback,
  });
  void perform().catch((error) => {
    console.error('[haptics][stage=trigger] failed', {
      stage: 'trigger',
      feedback,
      error: String(error),
    });
  });
}

export function selectionFeedback(): void {
  trigger('selection', Haptics.selectionAsync);
}

export function actionFeedback(): void {
  trigger('action', () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function successFeedback(): void {
  trigger('success', () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function warningFeedback(): void {
  trigger('warning', () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function errorFeedback(): void {
  trigger('error', () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
