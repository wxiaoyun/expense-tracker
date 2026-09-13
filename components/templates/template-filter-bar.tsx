import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { CategoryFilterChips } from '@/components/ui/category-picker';
import type { TemplateListFilter } from '@/db/template';
import { selectionFeedback } from '@/libs/haptics';
import { useThemeColors } from '@/hooks/useThemeColor';

type TemplateType = NonNullable<TemplateListFilter['type']>;

type TemplateFilterBarProps = {
  search: string;
  type: TemplateType;
  onSearchChange: (value: string) => void;
  onTypeChange: (type: TemplateType) => void;
  categories?: string[];
  selectedCategories?: string[];
  onCategoriesChange?: (categories: string[]) => void;
};

const TYPES: { label: string; value: TemplateType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Manual', value: 'manual' },
  { label: 'Scheduled', value: 'scheduled' },
];

export function TemplateFilterBar({
  search,
  type,
  onSearchChange,
  onTypeChange,
  categories = [],
  selectedCategories = [],
  onCategoriesChange,
}: TemplateFilterBarProps) {
  const colors = useThemeColors();
  return (
    <View style={{ gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
      <TextInput
        accessibilityLabel="Search templates"
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search templates"
        returnKeyType="search"
        clearButtonMode="while-editing"
        placeholderTextColor={colors.placeholder}
        style={{
          height: 38,
          borderRadius: 12,
          backgroundColor: colors.input,
          color: colors.text,
          paddingHorizontal: 12,
          fontSize: 16,
        }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TYPES.map((item) => {
          const selected = type === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) selectionFeedback();
                onTypeChange(item.value);
              }}
              style={{
                borderRadius: 15,
                backgroundColor: selected ? colors.primary : colors.input,
                paddingHorizontal: 14,
                paddingVertical: 7,
              }}
            >
              <Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: '600' }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {onCategoriesChange && (
        <CategoryFilterChips categories={categories} selected={selectedCategories} onChange={onCategoriesChange} />
      )}
    </View>
  );
}
