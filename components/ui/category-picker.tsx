import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, type StyleProp, type TextStyle } from 'react-native';
import Fuse from 'fuse.js';

import { selectionFeedback } from '@/libs/haptics';

export type CategoryOption = { name: string; icon: string; color: string };

type Props = {
  categories: CategoryOption[];
  value: string;
  onChange: (name: string) => void;
  inputLabel: string;
  inputStyle: StyleProp<TextStyle>;
  placeholder?: string;
};

/** Free-text category input above a fuzzy-filtered, horizontally scrolling chip list. */
export function CategoryPicker({
  categories,
  value,
  onChange,
  inputLabel,
  inputStyle,
  placeholder = 'Search or type custom category',
}: Props) {
  const [filter, setFilter] = useState('');

  const fuse = useMemo(
    () => new Fuse(categories, { keys: ['name'], threshold: 0.3, ignoreLocation: true, shouldSort: true }),
    [categories],
  );

  const visible = useMemo(() => {
    const query = filter.trim();
    if (!query) return categories;
    return fuse.search(query).map((result) => result.item);
  }, [filter, categories, fuse]);

  return (
    <>
      <TextInput
        accessibilityLabel={inputLabel}
        style={inputStyle}
        value={value}
        onChangeText={(text) => {
          onChange(text);
          setFilter(text);
        }}
        placeholder={placeholder}
        placeholderTextColor="#999"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContainer}
      >
        {visible.map((cat) => {
          const selected = value === cat.name;
          return (
            <Pressable
              key={cat.name}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${cat.name}`}
              accessibilityState={{ selected }}
              style={[styles.chip, { borderColor: cat.color }, selected && { backgroundColor: `${cat.color}20` }]}
              onPress={() => {
                selectionFeedback();
                onChange(cat.name);
                setFilter('');
              }}
            >
              <Text style={[styles.chipText, selected && { color: cat.color }]}>{cat.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}


type FilterProps = {
  categories: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Show the fuzzy search input above the chips. */
  searchable?: boolean;
};

/** Multi-select category filter: search input above fuzzy-filtered toggle chips. Selected chips always stay visible. */
export function CategoryFilterChips({ categories, selected, onChange, searchable = true }: FilterProps) {
  const [filter, setFilter] = useState('');

  const fuse = useMemo(
    () => new Fuse(categories, { threshold: 0.3, ignoreLocation: true, shouldSort: true }),
    [categories],
  );

  const visible = useMemo(() => {
    const query = filter.trim();
    if (!query) return categories;
    const matches = fuse.search(query).map((result) => result.item);
    return [...selected.filter((name) => !matches.includes(name)), ...matches];
  }, [filter, categories, fuse, selected]);

  if (categories.length === 0) return null;

  return (
    <>
      {searchable && <TextInput
        accessibilityLabel="Filter categories"
        value={filter}
        onChangeText={setFilter}
        placeholder="Filter categories"
        clearButtonMode="while-editing"
        style={styles.filterInput}
      />}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chipsContainer}
      >
        {visible.map((category) => {
          const isSelected = selected.includes(category);
          return (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityLabel={`Filter ${category}`}
              accessibilityState={{ selected: isSelected }}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              onPress={() => {
                selectionFeedback();
                onChange(isSelected ? selected.filter((item) => item !== category) : [...selected, category]);
              }}
            >
              <Text style={isSelected ? styles.filterChipTextSelected : styles.filterChipText}>{category}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  chipsScroll: { marginTop: 10, marginBottom: 12 },
  chipsContainer: { flexDirection: 'row', gap: 8 },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 14 },
  filterInput: { height: 38, borderRadius: 12, backgroundColor: '#F2F2F7', paddingHorizontal: 12, fontSize: 16 },
  filterChip: { borderRadius: 15, borderWidth: 1, borderColor: '#D1D1D6', paddingHorizontal: 12, paddingVertical: 6 },
  filterChipSelected: { borderColor: '#007AFF' },
  filterChipText: { color: '#3C3C43' },
  filterChipTextSelected: { color: '#007AFF' },
});
