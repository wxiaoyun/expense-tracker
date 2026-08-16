import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateRangePreset } from '@/hooks/useFilter';

type ExpenseFilterBarProps = {
  search: string;
  preset: DateRangePreset;
  onSearchChange: (value: string) => void;
  onPresetChange: (preset: DateRangePreset) => void;
  categories?: string[];
  selectedCategories?: string[];
  onCategoriesChange?: (categories: string[]) => void;
  customStart?: Date | null;
  customEnd?: Date | null;
  onCustomStartChange?: (date: Date) => void;
  onCustomEndChange?: (date: Date) => void;
};

const PRESETS: { label: string; accessibilityLabel: string; value: DateRangePreset }[] = [
  { label: 'Week', accessibilityLabel: 'This week', value: 'weekly' },
  { label: 'Month', accessibilityLabel: 'This month', value: 'monthly' },
  { label: 'Year', accessibilityLabel: 'Last 365 days', value: '365d' },
  { label: 'All', accessibilityLabel: 'All history', value: 'all' },
  { label: 'Custom', accessibilityLabel: 'Custom range', value: 'custom' },
];

export function ExpenseFilterBar({
  search,
  preset,
  onSearchChange,
  onPresetChange,
  categories = [],
  selectedCategories = [],
  onCategoriesChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: ExpenseFilterBarProps) {
  return (
    <View style={{ gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
      <TextInput
        accessibilityLabel="Search expenses"
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search expenses"
        returnKeyType="search"
        clearButtonMode="while-editing"
        style={{
          height: 38,
          borderRadius: 12,
          backgroundColor: '#F2F2F7',
          paddingHorizontal: 12,
          fontSize: 16,
        }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {PRESETS.map((item) => {
          const selected = preset === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel}
              accessibilityState={{ selected }}
              onPress={() => onPresetChange(item.value)}
              style={{
                borderRadius: 15,
                backgroundColor: selected ? '#007AFF' : '#F2F2F7',
                paddingHorizontal: 14,
                paddingVertical: 7,
              }}
            >
              <Text style={{ color: selected ? '#FFFFFF' : '#3C3C43', fontWeight: '600' }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {preset === 'custom' && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <DateTimePicker
            accessibilityLabel="Custom start date"
            value={customStart ?? new Date()}
            mode="date"
            display="compact"
            onChange={(_, date) => date && onCustomStartChange?.(date)}
          />
          <DateTimePicker
            accessibilityLabel="Custom end date"
            value={customEnd ?? new Date()}
            mode="date"
            display="compact"
            onChange={(_, date) => date && onCustomEndChange?.(date)}
          />
        </View>
      )}
      {categories.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {categories.map(category => {
          const selected = selectedCategories.includes(category);
          return <Pressable key={category} accessibilityRole="button" accessibilityLabel={`Filter ${category}`} accessibilityState={{ selected }} onPress={() => onCategoriesChange?.(selected ? selectedCategories.filter(item => item !== category) : [...selectedCategories, category])} style={{ borderRadius: 15, borderWidth: 1, borderColor: selected ? '#007AFF' : '#D1D1D6', paddingHorizontal: 12, paddingVertical: 6 }}><Text style={{ color: selected ? '#007AFF' : '#3C3C43' }}>{category}</Text></Pressable>;
        })}
      </ScrollView>}
    </View>
  );
}
