import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import ReanimatedSwipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { format } from 'date-fns';
import { Transaction } from '@/db/schema';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/libs/intl';
import Feather from '@expo/vector-icons/Feather';

type SwipeableTransactionProps = {
  transaction: Transaction;
  onToggleVerified: (id: string, verified: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, animateDelete: () => Promise<unknown>) => void;
};

const DELETE_THRESHOLD = 100;
const EDIT_THRESHOLD = -100;

function LeftAction(prog: SharedValue<number>, drag: SharedValue<number>) {
  const hasReachedThreshold = useSharedValue(false);

  useAnimatedReaction(
    () => drag.value,
    (dragValue) => {
      hasReachedThreshold.value = dragValue >= DELETE_THRESHOLD;
    }
  );

  const rStyle = useAnimatedStyle(() => ({
    opacity: drag.value / DELETE_THRESHOLD,
    transform: [{ translateX: drag.value }],
    backgroundColor: hasReachedThreshold.value ? '#FF3B30' : '#FF3B30',
  }));

  return (
    <View
      style={[
        styles.leftAction,
        rStyle,
        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
      ]}
    >
      <Feather name="trash-2" size={24} color="white" />
      <Text style={{ color: 'white', marginLeft: 8, fontWeight: '600' }}>
        {hasReachedThreshold.value ? 'Release to Delete' : 'Delete'}
      </Text>
    </View>
  );
}

function RightAction(prog: SharedValue<number>, drag: SharedValue<number>) {
  const hasReachedThreshold = useSharedValue(false);

  useAnimatedReaction(
    () => drag.value,
    (dragValue) => {
      hasReachedThreshold.value = dragValue <= EDIT_THRESHOLD;
    }
  );

  const rStyle = useAnimatedStyle(() => ({
    opacity: -drag.value / Math.abs(EDIT_THRESHOLD),
    transform: [{ translateX: drag.value }],
    backgroundColor: hasReachedThreshold.value ? '#007AFF' : '#007AFF',
  }));

  return (
    <View
      style={[
        styles.rightAction,
        rStyle,
        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, justifyContent: 'flex-end' },
      ]}
    >
      <Text style={{ color: 'white', marginRight: 8, fontWeight: '600' }}>
        {hasReachedThreshold.value ? 'Release to Edit' : 'Edit'}
      </Text>
      <Feather name="edit-2" size={24} color="white" />
    </View>
  );
}

export const TransactionRow: React.FC<SwipeableTransactionProps> = ({
  transaction,
  onToggleVerified,
  onEdit,
  onDelete,
}) => {
  const textColor = useThemeColor('text');
  const backgroundColor = useThemeColor('background');
  const secondaryColor = useThemeColor('backgroundSecondary');
  const isExpense = transaction.amount < 0;
  const amountColor = isExpense ? '#FF3B30' : '#34C759';

  const swipeableRef = React.useRef<SwipeableMethods>(null);
  const drag = useSharedValue(0);
  const prog = useSharedValue(0);

  const animateDelete = React.useCallback(async () => {
    return new Promise<void>((resolve) => {
      drag.value = withTiming(-120, { duration: 200, easing: Easing.inOut(Easing.quad) }, () => {
        runOnJS(resolve)();
      });
    });
  }, []);

  const onSwipeableOpen = React.useCallback((progress: number) => {
    drag.value = progress;
    prog.value = progress;
  }, []);

  const onSwipeableClose = React.useCallback(() => {
    drag.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.quad) });
  }, []);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value }],
  }));

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      overshootFriction={2}
      leftThreshold={DELETE_THRESHOLD}
      rightThreshold={Math.abs(EDIT_THRESHOLD)}
      onSwipeableWillOpen={(progress) => onSwipeableOpen(progress)}
      onSwipeableWillClose={onSwipeableClose}
      renderLeftActions={(progress, drag) => <LeftAction prog={progress} drag={drag} />}
      renderRightActions={(progress, drag) => <RightAction prog={progress} drag={drag} />}
      onSwipeableLeftOpen={() => onDelete(transaction.id, animateDelete)}
      onSwipeableRightOpen={() => onEdit(transaction.id)}
      onSwipeableLeftWillOpen={() => {
        runOnJS(() => {})();
      }}
      onSwipeableRightWillOpen={() => {
        runOnJS(() => {})();
      }}
    >
      <View style={[styles.row, { backgroundColor: secondaryColor }, rowStyle]}>
        <View style={styles.content}>
          <View style={styles.leftSection}>
            <Feather name="circle" size={24} color={amountColor} />
            <Text style={[styles.description, { color: textColor }]}>{transaction.description}</Text>
          </View>
          <View style={styles.rightSection}>
            <Text style={[styles.amount, { color: amountColor }]}>
              {formatCurrency(transaction.amount)}
            </Text>
            <View style={styles.meta}>
              <Text style={[styles.date, { color: textColor, opacity: 0.6 }]}>
                {format(transaction.transactionDate, 'MMM d, yyyy')}
              </Text>
              <Text style={[styles.category, { color: textColor, opacity: 0.6 }]}>
                {transaction.category}
              </Text>
            </View>
            {transaction.verified && (
              <Feather name="check-circle" size={18} color="#34C759" style={styles.verified} />
            )}
          </View>
        </View>
      </View>
    </ReanimatedSwipeable>
  );
};

const styles = StyleSheet.create({
  row: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  description: {
    fontSize: 16,
    fontWeight: '500',
  },
  amount: {
    fontSize: 18,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  date: {
    fontSize: 12,
  },
  category: {
    fontSize: 12,
  },
  verified: {
    marginLeft: 8,
  },
  leftAction: {
    flex: 1,
    justifyContent: 'center',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  rightAction: {
    flex: 1,
    justifyContent: 'center',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
});
