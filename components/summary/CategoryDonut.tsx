import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { formatCurrency } from '@/libs/intl';
import { useThemeColors } from '@/hooks/useThemeColor';

export type CategorySlice = { value: number; text: string; color: string };

export function CategoryDonut({ data }: { data: CategorySlice[] }) {
  const colors = useThemeColors();
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!data.length) return <Text style={[styles.empty, { color: colors.secondaryText }]}>No expense data in selected range</Text>;
  return <View style={[styles.card, { backgroundColor: colors.groupedBackground }]}><PieChart data={data} donut radius={80} innerRadius={50} innerCircleColor={colors.groupedBackground} centerLabelComponent={() => <View style={styles.center}><Text style={[styles.caption, { color: colors.secondaryText }]}>Total</Text><Text style={[styles.total, { color: colors.text }]}>{formatCurrency(-total)}</Text></View>} /></View>;
}

const styles = StyleSheet.create({ card: { alignItems: 'center', padding: 16, borderRadius: 16 }, center: { alignItems: 'center' }, caption: { fontSize: 13 }, total: { fontSize: 17, fontWeight: '600' }, empty: { textAlign: 'center', padding: 32 } });
