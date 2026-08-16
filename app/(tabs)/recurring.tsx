import React, { useCallback } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';

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
  const backgroundColor = '#fff';
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
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '500', color: textColor }}>
                {item.description}
             </Text>
              <Text style={{ fontSize: 12, color: textColor, opacity: 0.6, marginTop: 4 }}>
                {item.category} • {occurrenceToText(item.recurrenceValue)}
             </Text>
              {item.lastCharged && (
                <Text style={{ fontSize: 12, color: textColor, opacity: 0.6, marginTop: 2 }}>
                  Last charged: {format(new Date(item.lastCharged), 'MMM d, yyyy')}
               </Text>
              )}
           </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: amountColor }}>
              {formatCurrency(item.amount)}
           </Text>
         </View>
          <View style={{ flexDirection: 'row', marginTop: 8, gap: 12 }}>
            <Text style={{ color: '#007AFF' }} onPress={() => handleEdit(item.id)}>Edit</Text>
            <Text style={{ color: '#FF3B30' }} onPress={() => handleDelete(item.id)}>Delete</Text>
         </View>
       </View>
      );
    },
    [handleEdit, handleDelete, textColor],
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor }}>
        <ActivityIndicator size="large" color={textColor} />
     </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor }}>
        <ThemedText>Error loading recurring transactions</ThemedText>
     </View>
    );
  }

  if (allRecurring.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor }}>
        <Text style={{ fontSize: 20, fontWeight: '600', color: textColor, marginBottom: 8 }}>
          No Recurring Expenses
       </Text>
        <Text style={{ fontSize: 16, color: textColor, opacity: 0.6, textAlign: 'center' }}>
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
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 100 }}
      />
      <AddRecurringButton />
    </View>
  );
}
