import React, { useCallback, useEffect, useMemo } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { TransactionList } from '@/components/transactions/List';
import { listCategories, setVerification, softDeleteTransaction } from '@/db/transaction';
import { listTemplates } from '@/db/template';
import { useQuery } from '@tanstack/react-query';
import { computeDateRange, endOfDay, useCategoryFilter, useDateRange, useSearch, type DateRangePreset } from '@/hooks/useFilter';
import { queryKeys, useInfiniteTransactionListQuery } from '@/hooks/useTransactionsQuery';
import {
  useInvalidateTransactions,
  useInvalidateTransactionsAndTemplates,
} from '@/hooks/useQueryClient';
import { showConfirmDialog } from '@/libs/dialog';
import { AddExpenseButton } from '@/components/transactions/add-expense-button';
import { ExpenseFilterBar } from '@/components/transactions/expense-filter-bar';

const logFailure = (stage: string, error: unknown, transactionId?: string) => {
  console.error(`[transactions.ui][stage=${stage}] failed`, {
    ...(transactionId ? { transaction_id: transactionId } : {}),
    stage,
    error: String(error),
  });
};

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
  const templateQuery = useQuery({
    queryKey: queryKeys.templates.list({}),
    queryFn: () => listTemplates(),
  });

  useEffect(() => {
    if (templateQuery.error) {
      logFailure('load_templates', templateQuery.error);
    }
  }, [templateQuery.error]);

  const activeTemplateIds = useMemo(() => {
    if (templateQuery.error) return new Set<string>();
    return new Set((templateQuery.data ?? []).map((template) => template.id));
  }, [templateQuery.data, templateQuery.error]);

  const handlePresetChange = useCallback((preset: DateRangePreset) => {
    if (preset === 'custom') {
      setDateRange((prev) => {
        const customStart = prev.customStart ?? new Date();
        const customEnd = prev.customEnd ?? new Date();
        return {
          ...prev,
          preset: 'custom',
          customStart,
          customEnd,
          start: customStart,
          end: endOfDay(customEnd),
        };
      });
      return;
    }
    const range = computeDateRange(preset, new Date());
    setDateRange({ preset, ...range });
  }, [setDateRange]);

  const handleCustomStartChange = useCallback((date: Date) => {
    setDateRange((prev) => {
      const customEnd = prev.customEnd ?? new Date();
      return {
        ...prev,
        preset: 'custom',
        customStart: date,
        customEnd,
        start: date,
        end: endOfDay(customEnd),
      };
    });
  }, [setDateRange]);

  const handleCustomEndChange = useCallback((date: Date) => {
    setDateRange((prev) => {
      const customStart = prev.customStart ?? new Date(0);
      return {
        ...prev,
        preset: 'custom',
        customStart,
        customEnd: date,
        start: customStart,
        end: endOfDay(date),
      };
    });
  }, [setDateRange]);

  const invalidateTransactionQueries = useInvalidateTransactions();
  const invalidateTransactionAndTemplateQueries = useInvalidateTransactionsAndTemplates();

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
    orderBy: ['transactionDate', 'DESC'],
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
      console.info('[transactions.ui][stage=update_verification]', {
        transaction_id: id,
        stage: 'update_verification',
        verified,
      });
      try {
        const updated = await setVerification(id, verified ? 1 : 0);
        if (!updated) throw new Error('Transaction verification was not updated');
        await invalidateTransactionQueries();
      } catch (error) {
        logFailure('update_verification', error, id);
        Alert.alert('Error', 'Failed to update transaction verification');
      }
    },
    [invalidateTransactionQueries],
  );

  const handleEdit = useCallback(
    (id: string) => {
      console.info('[transactions.ui][stage=navigate_edit]', {
        transaction_id: id,
        stage: 'navigate_edit',
      });
      try {
        router.push({
          pathname: '/(drawer)/transaction',
          params: { id },
        });
      } catch (error) {
        logFailure('navigate_edit', error, id);
        Alert.alert('Error', 'Failed to open transaction');
      }
    },
    [router],
  );

  const handleSaveAsTemplate = useCallback(
    (id: string) => {
      router.push({
        pathname: '/(drawer)/template-edit',
        params: { sourceTransactionId: id },
      });
    },
    [router],
  );

  const handleViewTemplate = useCallback(
    (id: string) => {
      router.push({
        pathname: '/(drawer)/template-edit',
        params: { id },
      });
    },
    [router],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = await showConfirmDialog(
        'Delete Transaction',
        'Are you sure you want to delete this transaction?',
      );

      if (!confirmed) {
        return;
      }

      console.info('[transactions.ui][stage=soft_delete]', {
        transaction_id: id,
        stage: 'soft_delete',
      });

      try {
        const deleted = await softDeleteTransaction(id);
        if (!deleted) {
          console.error('[transactions.ui][stage=soft_delete] failed', {
            transaction_id: id,
            stage: 'soft_delete',
            reason: 'not_deleted',
          });
          Alert.alert('Error', 'Failed to delete transaction');
          return;
        }
        await invalidateTransactionAndTemplateQueries();
      } catch (error) {
        logFailure('soft_delete', error, id);
        Alert.alert('Error', 'Failed to delete transaction');
      }
    },
    [invalidateTransactionAndTemplateQueries],
  );

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor,
          justifyContent: 'center',
          alignItems: 'center',
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
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}
      >
        <ThemedText style={{ fontSize: 18, marginBottom: 8 }}>Error loading transactions</ThemedText>
        <ThemedText style={{ textAlign: 'center', opacity: 0.7 }}>
          {error.message || 'Something went wrong'}
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
        customStart={dateRange.customStart ?? null}
        customEnd={dateRange.customEnd ?? null}
        onCustomStartChange={handleCustomStartChange}
        onCustomEndChange={handleCustomEndChange}
      />
      <TransactionList
        onEdit={handleEdit}
        onSaveAsTemplate={handleSaveAsTemplate}
        onViewTemplate={handleViewTemplate}
        onDelete={handleDelete}
        onToggleVerified={handleToggleVerified}
        transactions={transactions}
        activeTemplateIds={activeTemplateIds}
        onLoadMore={hasNextPage ? fetchNextPage : undefined}
        isLoadingMore={isFetchingNextPage}
      />
      <AddExpenseButton />
    </View>
  );
}
