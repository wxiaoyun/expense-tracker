import React, { useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { PieChart, BarChart } from 'react-native-gifted-charts';

import { ThemedText } from '@/components/ThemedText';
import { useDateRange, useCategoryFilter } from '@/hooks/useFilter';
import { useTransactionSummary } from '@/hooks/useTransactionsQuery';
import { formatCurrency } from '@/libs/intl';

const CATEGORY_COLORS = [
  '#FF9500', '#007AFF', '#AF52DE', '#FF2D55',
  '#34C759', '#FF3B30', '#5856D6', '#8E8E93',
];

export default function SummaryScreen() {
  const [dateRange] = useDateRange();
  const [categories] = useCategoryFilter();
  const backgroundColor = '#fff';
  const textColor = '#000';

  const { data, isLoading, error } = useTransactionSummary({
    start: dateRange.start,
    end: dateRange.end,
    categories,
  });

  const pieData = useMemo(() => {
    if (!data?.byCategory) return [];
    // Show expense categories only (negative balances)
    const expenses = data.byCategory
      .filter((c) => c.expense < 0)
      .map((c, i) => ({
        value: Math.abs(c.expense),
        text: c.category,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
    return expenses;
  }, [data]);

  const totalExpense = pieData.reduce((sum, d) => sum + d.value, 0);
  const summary = data?.summary;
  const days = Math.max(
    1,
    Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 3600 * 1000)),
  );
  const avgPerDay = totalExpense / days;

  const top5 = useMemo(() => {
    return pieData.slice(0, 5);
  }, [pieData]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor }]}>
        <ActivityIndicator size="large" color={textColor} />
     </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor }]}>
        <ThemedText>Error loading summary</ThemedText>
     </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor }]} contentContainerStyle={styles.content}>
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiLabel, { color: textColor, opacity: 0.6 }]}>Total</Text>
          <Text style={[styles.kpiValue, { color: '#FF3B30' }]}>
            {formatCurrency(-Math.abs(summary?.expense ?? 0))}
         </Text>
       </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiLabel, { color: textColor, opacity: 0.6 }]}>Daily Avg</Text>
          <Text style={[styles.kpiValue, { color: textColor }]}>
            {formatCurrency(-Math.abs(avgPerDay))}
         </Text>
       </View>
     </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>By Category</Text>
        {pieData.length === 0 ? (
          <Text style={[styles.emptyText, { color: textColor, opacity: 0.6 }]}>
            No expense data in selected range
         </Text>
        ) : (
          <View style={styles.chartContainer}>
            <PieChart
              data={pieData}
              donut
              radius={80}
              innerRadius={50}
              innerCircleColor={backgroundColor}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: textColor, opacity: 0.6 }}>Total</Text>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: textColor }}>
                    {formatCurrency(-Math.abs(totalExpense))}
                 </Text>
               </View>
              )}
            />
         </View>
        )}
     </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Top 5 Categories</Text>
        {top5.map((cat, i) => {
          const pct = (cat.value / totalExpense) * 100;
          return (
            <View key={cat.text} style={styles.topRow}>
              <View style={[styles.dot, { backgroundColor: cat.color }]} />
              <Text style={[styles.topName, { color: textColor }]}>{cat.text}</Text>
              <Text style={[styles.topAmount, { color: textColor }]}>
                {formatCurrency(-cat.value)}
             </Text>
              <Text style={[styles.topPercent, { color: textColor, opacity: 0.6 }]}>
                {pct.toFixed(1)}%
             </Text>
           </View>
          );
        })}
     </View>
   </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 100,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#f2f2f7',
    padding: 16,
    borderRadius: 12,
  },
  kpiLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  chartContainer: {
    alignItems: 'center',
    backgroundColor: '#f2f2f7',
    padding: 16,
    borderRadius: 12,
  },
  emptyText: {
    textAlign: 'center',
    padding: 32,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  topName: {
    flex: 1,
    fontSize: 16,
  },
  topAmount: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  topPercent: {
    fontSize: 14,
    width: 50,
    textAlign: 'right',
  },
});
