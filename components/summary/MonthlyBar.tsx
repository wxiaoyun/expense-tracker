import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

export function MonthlyBar({ data }: { data: { month: string; expense: number }[] }) {
  if (!data.length) return <Text style={styles.empty}>No monthly history</Text>;
  const chart = data.slice(-12).map(row => ({ value: row.expense, label: row.month.slice(5), frontColor: '#007AFF' }));
  return <View style={styles.card}><BarChart data={chart} barWidth={18} spacing={12} roundedTop hideRules yAxisThickness={0} xAxisThickness={0} /></View>;
}

const styles = StyleSheet.create({ card: { backgroundColor: '#f2f2f7', paddingVertical: 16, borderRadius: 16, overflow: 'hidden' }, empty: { textAlign: 'center', padding: 32, color: '#6c6c70' } });
