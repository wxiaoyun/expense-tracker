import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { formatCurrency } from '@/libs/intl';

export type CategorySlice = { value: number; text: string; color: string };

export function CategoryDonut({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!data.length) return <Text style={styles.empty}>No expense data in selected range</Text>;
  return <View style={styles.card}><PieChart data={data} donut radius={80} innerRadius={50} innerCircleColor="#f2f2f7" centerLabelComponent={() => <View style={styles.center}><Text style={styles.caption}>Total</Text><Text style={styles.total}>{formatCurrency(-total)}</Text></View>} /></View>;
}

const styles = StyleSheet.create({ card: { alignItems: 'center', backgroundColor: '#f2f2f7', padding: 16, borderRadius: 16 }, center: { alignItems: 'center' }, caption: { fontSize: 13, color: '#6c6c70' }, total: { fontSize: 17, fontWeight: '600' }, empty: { textAlign: 'center', padding: 32, color: '#6c6c70' } });
