import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type CashFlowPeriod = {
  period: string;
  income: number;
  expense: number;
};

type CashFlowTrendProps = {
  data: CashFlowPeriod[];
  granularity: 'day' | 'month';
};

const formatLabel = (period: string, granularity: 'day' | 'month') => {
  const date = new Date(`${period}${granularity === 'day' ? 'T00:00:00' : '-01T00:00:00'}`);
  return date.toLocaleDateString('en-US', granularity === 'day'
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', year: '2-digit' });
};

export function CashFlowTrend({ data, granularity }: CashFlowTrendProps) {
  const maxValue = useMemo(
    () => Math.max(1, ...data.flatMap((item) => [item.income, item.expense])),
    [data],
  );
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  const groupWidth = data.length > 12 ? 38 : 56;
  const chartWidth = Math.max(320, data.length * groupWidth);

  if (!data.some((item) => item.income > 0 || item.expense > 0)) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>No cash-flow activity in selected range</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.income]} />
          <Text style={styles.legendText}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.expense]} />
          <Text style={styles.legendText}>Spending</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.chart, { width: chartWidth }]}>
          {data.map((item, index) => {
            const showLabel = index % labelEvery === 0 || index === data.length - 1;
            const incomeHeight = item.income === 0 ? 0 : Math.max(4, (item.income / maxValue) * 128);
            const expenseHeight = item.expense === 0 ? 0 : Math.max(4, (item.expense / maxValue) * 128);

            return (
              <View key={item.period} style={[styles.group, { width: groupWidth }]}>
                <View style={styles.bars}>
                  <View style={[styles.bar, styles.income, { height: incomeHeight }]} />
                  <View style={[styles.bar, styles.expense, { height: expenseHeight }]} />
                </View>
                <Text numberOfLines={1} style={styles.label}>
                  {showLabel ? formatLabel(item.period, granularity) : ''}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F2F2F7',
    borderRadius: 18,
    paddingTop: 14,
    paddingBottom: 10,
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
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  legendDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  legendText: {
    color: '#6E6E73',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  chart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    height: 166,
    marginTop: 8,
  },
  group: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  bars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 3,
    height: 132,
  },
  bar: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    width: 9,
  },
  income: {
    backgroundColor: '#34C759',
  },
  expense: {
    backgroundColor: '#FF3B30',
  },
  label: {
    color: '#6E6E73',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
    width: '100%',
  },
});
