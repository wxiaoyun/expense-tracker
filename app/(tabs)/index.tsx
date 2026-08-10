import React, { useCallback, useMemo } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Fuse from 'fuse.js';

import { ThemedText } from '@/components/ThemedText';
import { TransactionList } from '@/components/transactions/List';
import { deleteTransaction, setVerification } from '@/db/transaction';
import { useCategoryFilter, useDateRange, useSearch } from '@/hooks/useFilter';
import { useInfiniteTransactionListQuery } from '@/hooks/useTransactionsQuery';
import { useInvalidateTransactions } from '@/hooks/useQueryClient';
import { showConfirmDialog } from '@/libs/dialog';

export default function HomeScreen() {
  const router = useRouter();
  const backgroundColor = '#fff';
  const textColor = '#000';

  const [dateRange] = useDateRange();
  const [categories] = useCategoryFilter();
  const [search] = useSearch();

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
    verified: null,
  });

  const allTransactions = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items);
  }, [data]);

  const fuse = useMemo(() => {
    const fuseOptions = {
      keys: [
        { name: "description", weight: 0.7 },
        { name: "category", weight: 0.3 },
      ],
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 1,
    };
    return new Fuse(allTransactions, fuseOptions);
  }, [allTransactions]);

  const transactions = useMemo(() => {
    if (!search || search.trim() === "") {
      return allTransactions;
    }
    const searchResults = fuse.search(search.trim());
    return searchResults.map((result) => result.item);
  }, [allTransactions, fuse, search]);

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
    <TransactionList
      onEdit={handleEdit}
      onDelete={handleDelete}
      onToggleVerified={handleToggleVerified}
      transactions={transactions}
      onLoadMore={hasNextPage ? fetchNextPage : undefined}
      isLoadingMore={isFetchingNextPage}
    />
  );
}
