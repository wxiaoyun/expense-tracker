import React, { useCallback, useMemo } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { TransactionList } from '@/components/transactions/List';
import { deleteTransaction, listCategories, setVerification } from '@/db/transaction';
import { useQuery } from '@tanstack/react-query';
import { computeDateRange, useCategoryFilter, useDateRange, useSearch, type DateRangePreset } from '@/hooks/useFilter';
import { useInfiniteTransactionListQuery } from '@/hooks/useTransactionsQuery';
import { useInvalidateTransactions } from '@/hooks/useQueryClient';
import { showConfirmDialog } from '@/libs/dialog';
import { AddExpenseButton } from '@/components/transactions/add-expense-button';
import { ExpenseFilterBar } from '@/components/transactions/expense-filter-bar';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const backgroundColor = '#fff';
  const textColor = '#000';

  const [dateRange, setDateRange] = useDateRange();
  const [categories, setCategories] = useCategoryFilter();
  const [search, setSearch] = useSearch();
  const { data: availableCategories = [] } = useQuery({
    queryKey: ['categories', 'distinct'],
    queryFn: listCategories,
  });

  const handlePresetChange = useCallback((preset: DateRangePreset) => {
    const range = computeDateRange(preset, new Date());
    setDateRange({ preset, ...range });
  }, [setDateRange]);

  const invalidateTransactionQueries = useInvalidateTransactions();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteTransactionListQuery({
    start: dateRange.start,
    end: dateRange.end,
    limit: 50,
    orderBy: ["transactionDate", "DESC"],
    categories,
    search: search.trim() || undefined,
  });

  const allTransactions = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  const transactions = allTransactions;

  const handleToggleVerified = useCallback(
    async (id: string, verified: boolean) => {
      console.log(`Toggle verification for transaction ${id}: ${verified}`);
      try {
        await setVerification(id, verified ? 1 : 0);
        invalidateTransactionQueries();
      } catch (error) {
        console.error("Failed to update verification:", error);
        Alert.alert("Error", "Failed to update transaction verification");
      }
    },
    [invalidateTransactionQueries],
  );

  const handleEdit = useCallback(
    (id: string) => {
      console.log(`Edit transaction ${id}`);
      router.push({
        pathname: "/(drawer)/transaction",
        params: { id },
      });
    },
    [router],
  );

  const handleDelete = useCallback(
    async (id: string, animateDelete: () => Promise<unknown>) => {
      const confirmed = await showConfirmDialog(
        "Delete Transaction",
        "Are you sure you want to delete this transaction?",
      );

      if (!confirmed) {
        return;
      }

      console.log(`Confirmed delete transaction ${id}`);
      await animateDelete();

      try {
        await deleteTransaction(id);
        invalidateTransactionQueries();
      } catch (error) {
        console.error("Failed to delete transaction:", error);
        Alert.alert("Error", "Failed to delete transaction");
      }
    },
    [invalidateTransactionQueries],
  );

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={textColor} />
        <ThemedText style={{ marginTop: 16 }}>Loading transactions...</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <ThemedText style={{ fontSize: 18, marginBottom: 8 }}>Error loading transactions</ThemedText>
        <ThemedText style={{ textAlign: "center", opacity: 0.7 }}>
          {error.message || "Something went wrong"}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor, paddingTop: insets.top + 8 }}>
      <ExpenseFilterBar
        search={search}
        preset={dateRange.preset}
        onSearchChange={setSearch}
        onPresetChange={handlePresetChange}
        categories={availableCategories}
        selectedCategories={categories}
        onCategoriesChange={setCategories}
      />
      <TransactionList
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleVerified={handleToggleVerified}
        transactions={transactions}
        onLoadMore={hasNextPage ? fetchNextPage : undefined}
        isLoadingMore={isFetchingNextPage}
      />
      <AddExpenseButton />
    </View>
  );
}
