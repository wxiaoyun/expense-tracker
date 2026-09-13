import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useThemeColors } from '@/hooks/useThemeColor';

export function MonthlyBar({ data }: { data: { month: string; expense: number }[] }) {
  const colors = useThemeColors();
  if (!data.length) return <Text style={[styles.empty, { color: colors.secondaryText }]}>No monthly history</Text>;
  const chart = data.slice(-12).map(row => ({ value: row.expense, label: row.month.slice(5), frontColor: colors.primary }));
  return <View style={[styles.card, { backgroundColor: colors.groupedBackground }]}><BarChart data={chart} barWidth={18} spacing={12} roundedTop hideRules yAxisThickness={0} xAxisThickness={0} xAxisLabelTextStyle={{ color: colors.secondaryText }} yAxisTextStyle={{ color: colors.secondaryText }} /></View>;
}

const styles = StyleSheet.create({ card: { paddingVertical: 16, borderRadius: 16, overflow: 'hidden' }, empty: { textAlign: 'center', padding: 32 } });
