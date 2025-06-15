import Feather from "@expo/vector-icons/Feather";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import {
  useCategoryFilter,
  useDateRange,
  useVerifiedFilter,
} from "@/hooks/useFilter";
import { useCurrency } from "@/hooks/useKv";
import {
  useTransactionSummarizeByCategoryQuery,
  useTransactionSummarizeQuery,
} from "@/hooks/useQuery";
import { useThemeColor } from "@/hooks/useThemeColor";
import { getDateRange } from "@/libs/date";
import { formatCurrency } from "@/libs/intl";

type CategorySummary = {
  category: string;
  balance: number;
  income: number;
  expense: number;
  percentage: number;
};

export default function SummaryPage() {
  const backgroundColor = useThemeColor("background");
  const textColor = useThemeColor("text");
  const borderColor = useThemeColor("text") + "20";
  const destructiveColor = useThemeColor("destructive");
  const bottomTabBarHeight = useBottomTabBarHeight();
  const [currency] = useCurrency();

  // Filter states
  const { date: startDate, range } = useDateRange();
  const [selectedCategories] = useCategoryFilter();
  const [verifiedFilter] = useVerifiedFilter();

  // Calculate date range
  const { start, end } = useMemo(() => {
    return getDateRange(startDate, range);
  }, [startDate, range]);

  // Query parameters
  const queryParams = useMemo(
    () => ({
      start,
      end,
      categories:
        selectedCategories.length > 0 ? selectedCategories : undefined,
      verified: verifiedFilter !== null ? (verifiedFilter ? 1 : 0) : undefined,
    }),
    [start, end, selectedCategories, verifiedFilter],
  );

  // Fetch summary data
  const { data: overallSummary, isLoading: isLoadingSummary } =
    useTransactionSummarizeQuery(queryParams);
  const { data: categorySummary, isLoading: isLoadingCategories } =
    useTransactionSummarizeByCategoryQuery({
      start,
      end,
    });

  // Process category data with filtering
  const processedCategoryData = useMemo(() => {
    if (!categorySummary) return [];

    let filteredData = categorySummary;

    // Apply category filter
    if (selectedCategories.length > 0) {
      filteredData = filteredData.filter((item) =>
        selectedCategories.includes(item.category),
      );
    }

    // Calculate total for percentage calculation
    const totalExpense = Math.abs(
      filteredData.reduce((sum, item) => sum + item.expense, 0),
    );

    // Transform and sort data
    const processed: CategorySummary[] = filteredData
      .map((item) => ({
        ...item,
        percentage:
          totalExpense > 0 ? (Math.abs(item.expense) / totalExpense) * 100 : 0,
      }))
      .sort((a, b) => Math.abs(b.expense) - Math.abs(a.expense));

    return processed;
  }, [categorySummary, selectedCategories]);

  const renderCategoryItem = ({ item }: { item: CategorySummary }) => (
    <ThemedView style={[styles.categoryItem, { borderColor }]}>
      <ThemedView style={styles.categoryHeader}>
        <ThemedText style={[styles.categoryName, { color: textColor }]}>
          {item.category}
        </ThemedText>
        <ThemedText
          style={[styles.categoryPercentage, { color: textColor + "80" }]}
        >
          {item.percentage.toFixed(1)}%
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.categoryStats}>
        {item.income > 0 && (
          <ThemedView style={styles.statItem}>
            <ThemedText style={[styles.statLabel, { color: textColor + "80" }]}>
              Income
            </ThemedText>
            <ThemedText style={[styles.statValue, { color: "#22c55e" }]}>
              {formatCurrency(item.income, { currency })}
            </ThemedText>
          </ThemedView>
        )}

        {item.expense < 0 && (
          <ThemedView style={styles.statItem}>
            <ThemedText style={[styles.statLabel, { color: textColor + "80" }]}>
              Expense
            </ThemedText>
            <ThemedText style={[styles.statValue, { color: destructiveColor }]}>
              {formatCurrency(item.expense, { currency })}
            </ThemedText>
          </ThemedView>
        )}

        <ThemedView style={styles.statItem}>
          <ThemedText style={[styles.statLabel, { color: textColor + "80" }]}>
            Net
          </ThemedText>
          <ThemedText
            style={[
              styles.statValue,
              { color: item.balance >= 0 ? "#22c55e" : destructiveColor },
            ]}
          >
            {formatCurrency(item.balance, { currency })}
          </ThemedText>
        </ThemedView>
      </ThemedView>

      {/* Progress bar for expense percentage */}
      {item.expense < 0 && (
        <ThemedView
          style={[
            styles.progressBarContainer,
            { backgroundColor: borderColor },
          ]}
        >
          <ThemedView
            style={[
              styles.progressBar,
              {
                backgroundColor: destructiveColor,
                width: `${item.percentage}%`,
              },
            ]}
          />
        </ThemedView>
      )}
    </ThemedView>
  );

  const renderEmptyState = () => (
    <ThemedView style={styles.emptyContainer}>
      <Feather name="pie-chart" size={48} color={textColor + "40"} />
      <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
        No data available
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: textColor + "80" }]}>
        Try adjusting your filters or date range
      </ThemedText>
    </ThemedView>
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomTabBarHeight },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Overall Summary Cards */}
        <ThemedView style={styles.summarySection}>
          <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
            Overview
          </ThemedText>

          <ThemedView style={styles.summaryCards}>
            <ThemedView style={[styles.summaryCard, { borderColor }]}>
              <ThemedText
                style={[styles.cardLabel, { color: textColor + "80" }]}
              >
                Total Income
              </ThemedText>
              <ThemedText style={[styles.cardValue, { color: "#22c55e" }]}>
                {isLoadingSummary
                  ? "..."
                  : formatCurrency(overallSummary?.income || 0, { currency })}
              </ThemedText>
            </ThemedView>

            <ThemedView style={[styles.summaryCard, { borderColor }]}>
              <ThemedText
                style={[styles.cardLabel, { color: textColor + "80" }]}
              >
                Total Expenses
              </ThemedText>
              <ThemedText
                style={[styles.cardValue, { color: destructiveColor }]}
              >
                {isLoadingSummary
                  ? "..."
                  : formatCurrency(overallSummary?.expense || 0, { currency })}
              </ThemedText>
            </ThemedView>

            <ThemedView style={[styles.summaryCard, { borderColor }]}>
              <ThemedText
                style={[styles.cardLabel, { color: textColor + "80" }]}
              >
                Net Balance
              </ThemedText>
              <ThemedText
                style={[
                  styles.cardValue,
                  {
                    color:
                      (overallSummary?.balance || 0) >= 0
                        ? "#22c55e"
                        : destructiveColor,
                  },
                ]}
              >
                {isLoadingSummary
                  ? "..."
                  : formatCurrency(overallSummary?.balance || 0, { currency })}
              </ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>

        {/* Category Breakdown */}
        <ThemedView style={styles.categorySection}>
          <ThemedText style={[styles.sectionTitle, { color: textColor }]}>
            Category Breakdown
          </ThemedText>

          {isLoadingCategories ? (
            <ThemedView style={styles.loadingContainer}>
              <ThemedText
                style={[styles.loadingText, { color: textColor + "80" }]}
              >
                Loading categories...
              </ThemedText>
            </ThemedView>
          ) : processedCategoryData.length > 0 ? (
            <View style={styles.categoryListContainer}>
              {processedCategoryData.map((item) => (
                <View key={item.category}>{renderCategoryItem({ item })}</View>
              ))}
            </View>
          ) : (
            renderEmptyState()
          )}
        </ThemedView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 24,
  },
  summarySection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  summaryCards: {
    gap: 12,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  cardValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  categorySection: {
    gap: 16,
  },
  categoryListContainer: {
    gap: 12,
  },
  categoryItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "600",
  },
  categoryPercentage: {
    fontSize: 14,
    fontWeight: "500",
  },
  categoryStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  statItem: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
  loadingContainer: {
    padding: 32,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
});
