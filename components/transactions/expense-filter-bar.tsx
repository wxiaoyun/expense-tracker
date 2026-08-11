import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { DateRangePreset } from '@/hooks/useFilter';

type ExpenseFilterBarProps = {
  search: string;
  preset: DateRangePreset;
  onSearchChange: (value: string) => void;
  onPresetChange: (preset: DateRangePreset) => void;
  categories?: string[];
  selectedCategories?: string[];
  onCategoriesChange?: (categories: string[]) => void;
};

const PRESETS: { label: string; accessibilityLabel: string; value: DateRangePreset }[] = [
  { label: 'Month', accessibilityLabel: 'This month', value: 'monthly' },
  { label: 'Year', accessibilityLabel: 'Last 365 days', value: '365d' },
  { label: 'All', accessibilityLabel: 'All history', value: 'all' },
];

export function ExpenseFilterBar({
  search,
  preset,
  onSearchChange,
  onPresetChange,
  categories = [],
  selectedCategories = [],
  onCategoriesChange,
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
      {categories.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {categories.map(category => {
          const selected = selectedCategories.includes(category);
          return <Pressable key={category} accessibilityRole="button" accessibilityLabel={`Filter ${category}`} accessibilityState={{ selected }} onPress={() => onCategoriesChange?.(selected ? selectedCategories.filter(item => item !== category) : [...selectedCategories, category])} style={{ borderRadius: 15, borderWidth: 1, borderColor: selected ? '#007AFF' : '#D1D1D6', paddingHorizontal: 12, paddingVertical: 6 }}><Text style={{ color: selected ? '#007AFF' : '#3C3C43' }}>{category}</Text></Pressable>;
        })}
      </ScrollView>}
    </View>
  );
}
