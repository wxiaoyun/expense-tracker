import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { format } from 'date-fns';
import Feather from '@expo/vector-icons/Feather';

import { Transaction } from '@/db/schema';
import { useThemeColor } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/libs/intl';

type TransactionRowProps = {
  transaction: Transaction;
  onToggleVerified: (id: string, verified: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, animateDelete: () => Promise<unknown>) => void;
};

export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onToggleVerified,
  onEdit,
  onDelete,
}) => {
  const textColor = useThemeColor('text');
  const secondaryColor = useThemeColor('backgroundSecondary');
  const isExpense = transaction.amount < 0;
  const amountColor = isExpense ? '#FF3B30' : '#34C759';

  return (
    <View style={[styles.card, { backgroundColor: secondaryColor }]}>
      <View style={styles.content}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`Mark ${transaction.description} verified`}
          accessibilityState={{ checked: Boolean(transaction.verified) }}
          hitSlop={10}
          onPress={() => onToggleVerified(transaction.id, !transaction.verified)}
        >
          <Feather
            name={transaction.verified ? 'check-circle' : 'circle'}
            size={24}
            color={transaction.verified ? '#34C759' : amountColor}
          />
        </Pressable>
        <View style={styles.body}>
          <Text numberOfLines={1} style={[styles.description, { color: textColor }]}>
            {transaction.description}
          </Text>
          <View style={styles.meta}>
            <Text style={[styles.metaText, { color: textColor }]}>
              {format(transaction.transactionDate, 'MMM d, yyyy')}
            </Text>
            <Text style={[styles.metaText, { color: textColor }]}>
              {transaction.category}
            </Text>
          </View>
        </View>
        <Text style={[styles.amount, { color: amountColor }]}>
          {formatCurrency(transaction.amount)}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${transaction.description}`}
          hitSlop={8}
          onPress={() => onEdit(transaction.id)}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Feather name="edit-2" size={14} color="#007AFF" />
          <Text style={styles.actionTextBlue}>Edit</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${transaction.description}`}
          hitSlop={8}
          onPress={() => onDelete(transaction.id, async () => undefined)}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Feather name="trash-2" size={14} color="#FF3B30" />
          <Text style={styles.actionTextRed}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 5,
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    marginLeft: 12,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 3,
  },
  metaText: {
    fontSize: 13,
    opacity: 0.6,
  },
  amount: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  actionPressed: {
    opacity: 0.55,
  },
  actionTextBlue: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  actionTextRed: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
});
