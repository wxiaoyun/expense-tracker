import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import Fuse from "fuse.js";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity } from "react-native";
import DatePicker from "react-native-date-picker";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { DateRange, dateRangeOptions } from "@/constants";
import {
  useCategoryFilter,
  useDateRange,
  useVerifiedFilter,
} from "@/hooks/useFilter";
import { useTransactionCategoriesQuery } from "@/hooks/useQuery";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function TransactionFilter() {
  const backgroundColor = useThemeColor("background");
  const textColor = useThemeColor("text");
  const borderColor = useThemeColor("text") + "20";

  const {
    date: currentDate,
    range: currentRange,
    setDate,
    setRange,
  } = useDateRange();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Category filter state
  const [selectedCategories, setSelectedCategories] = useCategoryFilter();
  const { data: categories = [] } = useTransactionCategoriesQuery();
  const [categorySearchTerm, setCategorySearchTerm] = useState("");

  // Verified filter state
  const [verifiedFilter, setVerifiedFilter] = useVerifiedFilter();

  // Fuse.js setup for category search
  const fuse = useMemo(() => {
    return new Fuse(categories, {
      threshold: 0.3,
      includeScore: true,
    });
  }, [categories]);

  // Filtered categories based on search term
  const filteredCategories = useMemo(() => {
    if (!categorySearchTerm.trim()) {
      return categories;
    }
    return fuse.search(categorySearchTerm).map((result) => result.item);
  }, [categories, categorySearchTerm, fuse]);

  const openDatePicker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsDatePickerOpen(true);
  }, []);

  const handleCategoryToggle = useCallback(
    (category: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (selectedCategories.includes(category)) {
        setSelectedCategories(selectedCategories.filter((c) => c !== category));
      } else {
        setSelectedCategories([...selectedCategories, category]);
      }
    },
    [selectedCategories, setSelectedCategories],
  );

  const handleRangeSelect = useCallback(
    (range: DateRange) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setRange(range);
    },
    [setRange],
  );

  const handleVerifiedToggle = useCallback(
    (value: boolean | null) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setVerifiedFilter(value);
    },
    [setVerifiedFilter],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
      >
        {/* Date Range Section */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Start Date</ThemedText>
            {/* Custom Date Picker */}
            <TouchableOpacity
              onPress={openDatePicker}
              style={styles.datePickerButton}
            >
              <ThemedText style={[styles.datePickerText, { color: textColor }]}>
                {format(currentDate, "EEEE, MMMM dd, yyyy")}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>

          <DatePicker
            modal
            mode="date"
            open={isDatePickerOpen}
            date={currentDate}
            onConfirm={(date) => {
              setDate(date);
              setIsDatePickerOpen(false);
            }}
            onCancel={() => setIsDatePickerOpen(false)}
          />

          <ThemedText style={styles.sectionTitle}>Date Range</ThemedText>
          {/* Date Range Options */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollContainer}
            keyboardShouldPersistTaps="always"
          >
            {dateRangeOptions.map((range) => {
              const isSelected = currentRange === range;
              return (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.filterButton,
                    {
                      borderColor: borderColor,
                      backgroundColor: isSelected
                        ? textColor + "10"
                        : "transparent",
                    },
                  ]}
                  onPress={() => handleRangeSelect(range)}
                >
                  <ThemedText
                    style={[
                      styles.filterButtonText,
                      {
                        color: isSelected ? textColor : textColor + "80",
                        fontWeight: isSelected ? "600" : "500",
                      },
                    ]}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </ThemedView>

        {/* Verified Status Section */}
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            Verification Status
          </ThemedText>
          <ThemedView style={styles.verifiedContainer}>
            {[
              { label: "All", value: null },
              { label: "Verified", value: true },
              { label: "Unverified", value: false },
            ].map((option) => {
              const isSelected = verifiedFilter === option.value;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.verifiedButton,
                    {
                      borderColor: borderColor,
                      backgroundColor: isSelected
                        ? textColor + "10"
                        : "transparent",
                    },
                  ]}
                  onPress={() => handleVerifiedToggle(option.value)}
                >
                  <ThemedText
                    style={[
                      styles.verifiedButtonText,
                      {
                        color: isSelected ? textColor : textColor + "80",
                        fontWeight: isSelected ? "600" : "500",
                      },
                    ]}
                  >
                    {option.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ThemedView>
        </ThemedView>

        {/* Categories Section */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Categories</ThemedText>
            {selectedCategories.length > 0 && (
              <ThemedText
                style={[styles.selectedCount, { color: textColor + "80" }]}
              >
                {selectedCategories.length} selected
              </ThemedText>
            )}
          </ThemedView>

          {/* Category Search Bar */}
          <TextInput
            style={[
              styles.searchInput,
              {
                borderColor: borderColor,
                color: textColor,
                backgroundColor: backgroundColor,
              },
            ]}
            placeholder="Search categories..."
            placeholderTextColor={textColor + "60"}
            value={categorySearchTerm}
            onChangeText={setCategorySearchTerm}
            clearButtonMode="while-editing"
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollContainer}
            keyboardShouldPersistTaps="always"
          >
            {filteredCategories.map((category) => {
              const isSelected = selectedCategories.includes(category);
              return (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryButton,
                    {
                      borderColor: borderColor,
                      backgroundColor: isSelected
                        ? textColor + "10"
                        : "transparent",
                    },
                  ]}
                  onPress={() => handleCategoryToggle(category)}
                >
                  <ThemedText
                    style={[
                      styles.categoryButtonText,
                      {
                        color: isSelected ? textColor : textColor + "80",
                        fontWeight: isSelected ? "600" : "500",
                      },
                    ]}
                  >
                    {category}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {categories.length === 0 && (
            <ThemedText style={[styles.emptyText, { color: textColor + "60" }]}>
              No categories available
            </ThemedText>
          )}

          {categories.length > 0 &&
            filteredCategories.length === 0 &&
            categorySearchTerm.trim() && (
              <ThemedText
                style={[styles.emptyText, { color: textColor + "60" }]}
              >
                No categories found matching &ldquo;{categorySearchTerm}&rdquo;
              </ThemedText>
            )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  clearButton: {
    fontSize: 16,
    fontWeight: "600",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  selectedCount: {
    fontSize: 14,
  },
  horizontalScrollContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 2,
  },
  filterButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  datePickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  datePickerText: {
    fontSize: 16,
    fontWeight: "500",
  },
  verifiedContainer: {
    flexDirection: "row",
    gap: 8,
  },
  verifiedButton: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  verifiedButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  searchInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  categoryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  emptyText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
  },
  summaryContainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  summaryText: {
    fontSize: 14,
  },
});
