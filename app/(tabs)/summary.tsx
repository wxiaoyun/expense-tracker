import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpenseFilterBar } from '@/components/transactions/expense-filter-bar';
import { CashFlowTrend } from '@/components/summary/CashFlowTrend';
import { CategoryDonut, type CategorySlice } from '@/components/summary/CategoryDonut';
import { computeDateRange, endOfDay, useDateRange, type DateRangePreset } from '@/hooks/useFilter';
import { useTransactionSummary } from '@/hooks/useTransactionsQuery';
import { formatCurrency } from '@/libs/intl';

const CATEGORY_COLORS = [
  '#007AFF', '#AF52DE', '#FF9500', '#FF2D55',
  '#34C759', '#5856D6', '#00C7BE', '#A2845E',
];

const colorForCategory = (category: string) => {
  let hash = 0;
  for (const character of category) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
};

const getTrendGranularity = (preset: DateRangePreset, start: Date, end: Date) => {
  if (preset === 'weekly' || preset === 'monthly') return 'day' as const;
  const rangeDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return rangeDays <= 90 ? 'day' as const : 'month' as const;
};

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.metricValue, { color }]}>
        {value}
      </Text>
    </View>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

function CategoryBreakdown({
  data,
  kind,
}: {
  data: CategorySlice[];
  kind: 'income' | 'expense';
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (!data.length) {
    return <EmptyCard message={`No ${kind === 'income' ? 'income' : 'spending'} categories in selected range`} />;
  }

  return (
    <View style={styles.breakdownCard}>
      {data.map((item) => {
        const percentage = total === 0 ? 0 : (item.value / total) * 100;
        const amount = kind === 'expense' ? -item.value : item.value;
        return (
          <View key={item.text} style={styles.categoryRow}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryNameGroup}>
                <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                <Text numberOfLines={1} style={styles.categoryName}>{item.text}</Text>
              </View>
              <Text style={styles.categoryAmount}>{formatCurrency(amount)}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { backgroundColor: item.color, width: `${percentage}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const [dateRange, setDateRange] = useDateRange();
  const granularity = useMemo(
    () => getTrendGranularity(dateRange.preset, dateRange.start, dateRange.end),
    [dateRange.end, dateRange.preset, dateRange.start],
  );
  const { data, isLoading, error } = useTransactionSummary({
    start: dateRange.start,
    end: dateRange.end,
    granularity,
  });

  const handlePresetChange = useCallback((preset: DateRangePreset) => {
    if (preset === 'custom') {
      setDateRange((previous) => {
        const customStart = previous.customStart ?? new Date();
        const customEnd = previous.customEnd ?? new Date();
        return {
          ...previous,
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
    setDateRange((previous) => {
      const customEnd = previous.customEnd ?? new Date();
      return {
        ...previous,
        preset: 'custom',
        customStart: date,
        customEnd,
        start: date,
        end: endOfDay(customEnd),
      };
    });
  }, [setDateRange]);

  const handleCustomEndChange = useCallback((date: Date) => {
    setDateRange((previous) => {
      const customStart = previous.customStart ?? new Date(0);
      return {
        ...previous,
        preset: 'custom',
        customStart,
        customEnd: date,
        start: customStart,
        end: endOfDay(date),
      };
    });
  }, [setDateRange]);

  const spendingCategories = useMemo(() => {
    return (data?.byCategory ?? [])
      .filter((category) => category.expense < 0)
      .map((category) => ({
        value: Math.abs(category.expense),
        text: category.category,
        color: colorForCategory(category.category),
      }))
      .sort((a, b) => b.value - a.value);
  }, [data?.byCategory]);

  const incomeCategories = useMemo(() => {
    return (data?.byCategory ?? [])
      .filter((category) => category.income > 0)
      .map((category) => ({
        value: category.income,
        text: category.category,
        color: colorForCategory(category.category),
      }))
      .sort((a, b) => b.value - a.value);
  }, [data?.byCategory]);

  const summary = data?.summary;
  const netBalance = summary?.balance ?? 0;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#007AFF" size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Error loading summary</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Summary</Text>
        <Text style={styles.pageSubtitle}>Cash flow and category breakdown</Text>
      </View>
      <ExpenseFilterBar
        preset={dateRange.preset}
        onPresetChange={handlePresetChange}
        showSearch={false}
        showCategories={false}
        customStart={dateRange.customStart ?? null}
        customEnd={dateRange.customEnd ?? null}
        onCustomStartChange={handleCustomStartChange}
        onCustomEndChange={handleCustomEndChange}
      />

      <View style={styles.metricRow}>
        <MetricCard label="Income" value={formatCurrency(summary?.income ?? 0)} color="#34C759" />
        <MetricCard label="Spending" value={formatCurrency(summary?.expense ?? 0)} color="#FF3B30" />
        <MetricCard label="Net" value={formatCurrency(netBalance)} color={netBalance < 0 ? '#FF3B30' : '#007AFF'} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spending by Category</Text>
        {spendingCategories.length > 0 ? (
          <CategoryDonut data={spendingCategories} />
        ) : (
          <EmptyCard message="No spending in selected range" />
        )}
        <View style={styles.breakdownSpacing}>
          <CategoryBreakdown data={spendingCategories} kind="expense" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Income by Category</Text>
        <CategoryBreakdown data={incomeCategories} kind="income" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cash Flow Trend</Text>
        <CashFlowTrend data={data?.byPeriod ?? []} granularity={granularity} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
  },
  pageHeader: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  pageTitle: {
    color: '#111111',
    fontSize: 34,
    fontWeight: '700',
  },
  pageSubtitle: {
    color: '#6E6E73',
    fontSize: 15,
    marginTop: 4,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 26,
  },
  metricCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    flex: 1,
    minWidth: 0,
    padding: 12,
  },
  metricLabel: {
    color: '#6E6E73',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 19,
    fontWeight: '700',
  },
  section: {
    marginBottom: 26,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  breakdownSpacing: {
    marginTop: 10,
  },
  breakdownCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 18,
    padding: 14,
  },
  categoryRow: {
    marginBottom: 14,
  },
  categoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  categoryNameGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    marginRight: 12,
  },
  categoryDot: {
    borderRadius: 5,
    height: 10,
    marginRight: 8,
    width: 10,
  },
  categoryName: {
    color: '#111111',
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  categoryAmount: {
    color: '#3C3C43',
    fontSize: 14,
    fontWeight: '600',
  },
  progressTrack: {
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 3,
    height: '100%',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 18,
    padding: 28,
  },
  emptyText: {
    color: '#6E6E73',
    fontSize: 15,
    textAlign: 'center',
  },
});
