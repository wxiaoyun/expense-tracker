import React, { useCallback } from 'react';
import { View, Text, ActivityIndicator, Alert, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import Feather from '@expo/vector-icons/Feather';

import { ThemedText } from '@/components/ThemedText';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { listRecurringTransactions, deleteRecurringTransaction, RecurringTransaction } from '@/db/recurring';
import { showConfirmDialog } from '@/libs/dialog';
import { formatCurrency } from '@/libs/intl';
import { occurrenceToText } from '@/libs/date';
import { AddRecurringButton } from '@/components/transactions/add-recurring-button';

export default function RecurringScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const backgroundColor = '#F2F2F7';
  const textColor = '#000';

  const { data, isLoading, error } = useInfiniteQuery({
    queryKey: ['recurring', 'list'],
    queryFn: async () => {
      const items = await listRecurringTransactions();
      return { items, nextOffset: null };
    },
    initialPageParam: 0,
    getNextPageParam: () => null,
  });

  const allRecurring = React.useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  const handleEdit = useCallback(
    (id: string) => {
      router.push({
        pathname: '/(drawer)/recurring-edit',
        params: { id },
      });
    },
    [router],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = await showConfirmDialog(
        'Delete Recurring Transaction',
        'This will delete the recurring rule. Past transactions will remain.',
      );
      if (!confirmed) return;
      try {
        await deleteRecurringTransaction(id);
        queryClient.invalidateQueries({ queryKey: ['recurring'] });
      } catch (err) {
        console.error('[recurring.list][stage=delete_rule] recurring delete failed', { id, error: String(err) });
        Alert.alert('Error', 'Failed to delete recurring transaction');
      }
    },
    [queryClient],
  );

  const renderItem = React.useCallback(
    ({ item }: { item: RecurringTransaction }) => {
      const isExpense = item.amount < 0;
      const amountColor = isExpense ? '#FF3B30' : '#34C759';
      return (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <Feather name="repeat" size={18} color="#007AFF" />
            </View>
            <View style={styles.cardBody}>
              <Text numberOfLines={1} style={styles.cardTitle}>
                {item.description}
              </Text>
              <Text numberOfLines={1} style={styles.cardMeta}>
                {item.category} • {occurrenceToText(item.recurrenceValue)}
              </Text>
              {item.lastCharged ? (
                <Text numberOfLines={1} style={styles.cardMeta}>
                  Last charged {format(new Date(item.lastCharged), 'MMM d, yyyy')}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.cardAmount, { color: amountColor }]}>
              {formatCurrency(item.amount)}
            </Text>
          </View>
          <View style={styles.cardActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.description}`}
              hitSlop={8}
              onPress={() => handleEdit(item.id)}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            >
              <Feather name="edit-2" size={14} color="#007AFF" />
              <Text style={styles.actionTextBlue}>Edit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.description}`}
              hitSlop={8}
              onPress={() => handleDelete(item.id)}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            >
              <Feather name="trash-2" size={14} color="#FF3B30" />
              <Text style={styles.actionTextRed}>Delete</Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [handleEdit, handleDelete],
  );

  const listHeader = React.useMemo(
    () => (
      <View style={styles.listHeader}>
        <Text style={styles.pageTitle}>Recurring</Text>
        <Text style={styles.pageSubtitle}>Subscriptions, bills, and scheduled income</Text>
      </View>
    ),
    [],
  );

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor }]}>
        <ActivityIndicator size="large" color={textColor} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor, padding: 20 }]}>
        <ThemedText>Error loading recurring transactions</ThemedText>
      </View>
    );
  }

  if (allRecurring.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor, padding: 24 }]}>
        <Feather name="repeat" size={42} color="#8E8E93" />
        <Text style={styles.emptyTitle}>No Recurring Expenses</Text>
        <Text style={styles.emptySubtitle}>
          Create recurring rules for subscriptions, bills, or regular income
        </Text>
        <AddRecurringButton />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor }}>
      <FlashList
        data={allRecurring}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 110,
          paddingHorizontal: 16,
        }}
      />
      <AddRecurringButton />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listHeader: {
    paddingBottom: 8,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#000',
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#6E6E73',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF18',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  cardMeta: {
    fontSize: 13,
    color: '#6E6E73',
    marginTop: 2,
  },
  cardAmount: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
  },
  cardActions: {
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
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6E6E73',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
