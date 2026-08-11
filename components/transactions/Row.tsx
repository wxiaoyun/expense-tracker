import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import ReanimatedSwipeable, {
  SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SharedValue } from 'react-native-reanimated';
import { format } from 'date-fns';
import { Transaction } from '@/db/schema';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/libs/intl';
import Feather from '@expo/vector-icons/Feather';
import { getTransactionSwipeAction } from './swipe-action';

type SwipeableTransactionProps = {
  transaction: Transaction;
  onToggleVerified: (id: string, verified: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, animateDelete: () => Promise<unknown>) => void;
};

const LeftAction: React.FC<{ progress: SharedValue<number>; translation: SharedValue<number> }> = ({ progress, translation }) => {
  return (
    <View style={[styles.deleteAction, { justifyContent: 'center', paddingHorizontal: 20 }]}>
      <Feather name="trash-2" size={24} color="white" />
      <Text style={styles.actionText}>Delete</Text>
    </View>
  );
};

const RightAction: React.FC<{ progress: SharedValue<number>; translation: SharedValue<number> }> = ({ progress, translation }) => {
  return (
    <View style={[styles.editAction, { justifyContent: 'center', alignItems: 'flex-end' }]}>
      <Text style={styles.actionText}>Edit</Text>
      <Feather name="edit-2" size={24} color="white" />
    </View>
  );
};

export const TransactionRow: React.FC<SwipeableTransactionProps> = ({
  transaction,
  onToggleVerified,
  onEdit,
  onDelete,
}) => {
  const textColor = useThemeColor('text');
  const secondaryColor = useThemeColor('backgroundSecondary');
  const isExpense = transaction.amount < 0;
  const amountColor = isExpense ? '#FF3B30' : '#34C759';

  const swipeableRef = React.useRef<SwipeableMethods>(null);

  const animateDelete = React.useCallback(async () => {
    swipeableRef.current?.close();
    return undefined;
  }, []);

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      overshootFriction={2}
      leftThreshold={80}
      rightThreshold={80}
      renderLeftActions={(progress, translation) => (
        <LeftAction progress={progress} translation={translation} />
      )}
      renderRightActions={(progress, translation) => (
        <RightAction progress={progress} translation={translation} />
      )}
      onSwipeableOpen={(direction) => {
        const action = getTransactionSwipeAction(direction);
        if (action === 'edit') onEdit(transaction.id);
        else onDelete(transaction.id, animateDelete);
      }}
    >
      <View style={[styles.row, { backgroundColor: secondaryColor }]}>
        <View style={styles.content}>
          <View style={styles.leftSection}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={`Mark ${transaction.description} verified`}
              accessibilityState={{ checked: Boolean(transaction.verified) }}
              hitSlop={10}
              onPress={() => onToggleVerified(transaction.id, !transaction.verified)}
            >
              <Feather name={transaction.verified ? 'check-circle' : 'circle'} size={24} color={transaction.verified ? '#34C759' : amountColor} />
            </Pressable>
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
    flex: 1,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  description: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
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
  deleteAction: {
    backgroundColor: '#FF3B30',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  editAction: {
    backgroundColor: '#007AFF',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  actionText: {
    color: 'white',
    fontWeight: '600',
    marginHorizontal: 8,
  },
});
