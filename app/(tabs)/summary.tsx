import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExpenseFilterBar } from '@/components/transactions/expense-filter-bar';
import { CashFlowTrend } from '@/components/summary/CashFlowTrend';
import { computeDateRange, endOfDay, useDateRange, type DateRangePreset } from '@/hooks/useFilter';
import { useTransactionSummary } from '@/hooks/useTransactionsQuery';
import { formatCurrency } from '@/libs/intl';
import { useThemeColors } from '@/hooks/useThemeColor';
import { customCategoryColor } from '@/libs/category-color';

type CategorySlice = { value: number; text: string; color: string };

const getTrendGranularity = (preset: DateRangePreset, start: Date, end: Date) => {
  if (preset === 'weekly' || preset === 'monthly') return 'day' as const;
  const rangeDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return rangeDays <= 90 ? 'day' as const : 'month' as const;
};

function OverviewCard({ income, spending, net }: { income: number; spending: number; net: number }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.overviewCard, { backgroundColor: colors.primary }]}>
      <Text style={styles.overviewLabel}>Net change</Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        numberOfLines={1}
        selectable
        style={styles.overviewValue}
      >
        {formatCurrency(net)}
      </Text>
      <View style={styles.overviewDivider} />
      <View style={styles.overviewDetails}>
        <View style={styles.overviewDetail}>
          <Text style={styles.overviewDetailLabel}>Income</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            selectable
            style={styles.overviewDetailValue}
          >
            {formatCurrency(income)}
          </Text>
        </View>
        <View style={styles.overviewDetail}>
          <Text style={styles.overviewDetailLabel}>Spending</Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            numberOfLines={1}
            selectable
            style={styles.overviewDetailValue}
          >
            {formatCurrency(Math.abs(spending))}
          </Text>
        </View>
      </View>
    </View>
  );
}

function EmptyCard({ message }: { message: string }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
      <Text style={[styles.emptyText, { color: colors.secondaryText }]}>{message}</Text>
    </View>
  );
}

function CategoryBreakdown({
  data,
  total,
}: {
  data: CategorySlice[];
  total: number;
}) {
  const colors = useThemeColors();

  if (!data.length) {
    return <EmptyCard message="No spending in selected range" />;
  }

  return (
    <View style={[styles.breakdownCard, { backgroundColor: colors.surface }]}>
      {data.map((item) => {
        const percentage = total === 0 ? 0 : (item.value / total) * 100;
        return (
          <View key={item.text} style={styles.categoryRow}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryNameGroup}>
                <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                <Text numberOfLines={1} style={[styles.categoryName, { color: colors.text }]}>{item.text}</Text>
              </View>
              <View style={styles.categoryValueGroup}>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  numberOfLines={1}
                  selectable
                  style={[styles.categoryAmount, { color: colors.text }]}
                >
                  {formatCurrency(item.value)}
                </Text>
                <Text style={[styles.categoryPercent, { color: colors.secondaryText }]}>
                  {percentage.toFixed(1)}%
                </Text>
              </View>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.chartTrack }]}>
              <View style={[styles.progressFill, { backgroundColor: item.color, width: `${percentage}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function SummaryScreen() {
  const colors = useThemeColors();
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
        color: customCategoryColor(category.category),
      }))
      .sort((a, b) => b.value - a.value);
  }, [data?.byCategory]);

  const summary = data?.summary;
  const netBalance = summary?.balance ?? 0;
  const spendingTotal = Math.abs(summary?.expense ?? 0);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.groupedBackground }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.groupedBackground }]}>
        <Text style={[styles.errorText, { color: colors.destructive }]}>Error loading summary</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.groupedBackground }]}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Summary</Text>
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

      <View style={styles.overviewSection}>
        <OverviewCard
          income={summary?.income ?? 0}
          spending={summary?.expense ?? 0}
          net={netBalance}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Top spending</Text>
          {spendingCategories.length > 5 ? (
            <Text style={[styles.sectionCaption, { color: colors.secondaryText }]}>
              5 of {spendingCategories.length} categories
            </Text>
          ) : null}
        </View>
        <CategoryBreakdown data={spendingCategories.slice(0, 5)} total={spendingTotal} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cash flow</Text>
        </View>
        <CashFlowTrend data={data?.byPeriod ?? []} granularity={granularity} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
  },
  pageHeader: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '700',
  },

  overviewSection: {
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 26,
  },
  overviewCard: {
    borderCurve: 'continuous',
    borderRadius: 24,
    boxShadow: '0 8px 24px rgba(0, 98, 204, 0.2)',
    padding: 20,
  },
  overviewLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '600',
  },
  overviewValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: -1,
    marginTop: 4,
  },
  overviewDivider: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    height: StyleSheet.hairlineWidth,
    marginVertical: 18,
  },
  overviewDetails: {
    flexDirection: 'row',
    gap: 24,
  },
  overviewDetail: {
    flex: 1,
    minWidth: 0,
  },
  overviewDetailLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
  },
  overviewDetailValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    marginTop: 3,
  },
  section: {
    marginBottom: 26,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionCaption: {
    fontSize: 12,
    fontWeight: '500',
  },
  breakdownCard: {
    borderCurve: 'continuous',
    borderRadius: 18,
    gap: 18,
    padding: 16,
  },
  categoryRow: {
    gap: 8,
  },
  categoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryNameGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    marginRight: 16,
  },
  categoryDot: {
    borderRadius: 5,
    height: 10,
    marginRight: 8,
    width: 10,
  },
  categoryName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  categoryAmount: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    maxWidth: 132,
  },
  categoryValueGroup: {
    alignItems: 'flex-end',
  },
  categoryPercent: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  progressTrack: {
    borderRadius: 2,
    height: 4,
    overflow: 'hidden',
    opacity: 0.85,
  },
  progressFill: {
    borderRadius: 3,
    height: '100%',
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 18,
    padding: 28,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
});
