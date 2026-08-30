import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { TemplateListFilter } from '@/db/template';
import { selectionFeedback } from '@/libs/haptics';

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
  return (
    <View style={{ gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
      <TextInput
        accessibilityLabel="Search templates"
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search templates"
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
      {categories.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {categories.map((category) => {
            const selected = selectedCategories.includes(category);
            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityLabel={`Filter ${category}`}
                accessibilityState={{ selected }}
                onPress={() => {
                  if (!onCategoriesChange) return;
                  selectionFeedback();
                  onCategoriesChange(
                    selected
                      ? selectedCategories.filter((item) => item !== category)
                      : [...selectedCategories, category],
                  );
                }}
                style={{
                  borderRadius: 15,
                  borderWidth: 1,
                  borderColor: selected ? '#007AFF' : '#D1D1D6',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: selected ? '#007AFF' : '#3C3C43' }}>{category}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
