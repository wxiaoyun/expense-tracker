import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/hooks/useThemeColor";
import { formatCurrency } from "@/libs/intl";

type CashFlowPeriod = {
  period: string;
  income: number;
  expense: number;
};

type CashFlowTrendProps = {
  data: CashFlowPeriod[];
  granularity: "day" | "month";
};

const formatLabel = (period: string, granularity: "day" | "month") => {
  const date = new Date(
    `${period}${granularity === "day" ? "T00:00:00" : "-01T00:00:00"}`,
  );
  return date.toLocaleDateString(
    "en-US",
    granularity === "day"
      ? { month: "short", day: "numeric" }
      : { month: "short", year: "2-digit" },
  );
};

export function CashFlowTrend({ data, granularity }: CashFlowTrendProps) {
  const colors = useThemeColors();
  const maxValue = useMemo(
    () => Math.max(1, ...data.flatMap((item) => [item.income, item.expense])),
    [data],
  );
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  const groupWidth = data.length > 12 ? 42 : 58;
  const chartWidth = Math.max(328, data.length * groupWidth);

  if (!data.some((item) => item.income > 0 || item.expense > 0)) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
          No cash-flow activity in selected range
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.success }]}
          />
          <Text style={[styles.legendText, { color: colors.secondaryText }]}>
            Income
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: colors.destructive }]}
          />
          <Text style={[styles.legendText, { color: colors.secondaryText }]}>
            Spending
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.chart, { width: chartWidth }]}>
          {data.map((item, index) => {
            const showLabel =
              index % labelEvery === 0 || index === data.length - 1;
            const incomeHeight =
              item.income === 0
                ? 0
                : Math.max(4, (item.income / maxValue) * 120);
            const expenseHeight =
              item.expense === 0
                ? 0
                : Math.max(4, (item.expense / maxValue) * 120);

            return (
              <View
                accessibilityLabel={`${formatLabel(item.period, granularity)}. Income ${formatCurrency(item.income)}. Spending ${formatCurrency(item.expense)}.`}
                accessible
                key={item.period}
                style={[styles.group, { width: groupWidth }]}
              >
                <View style={styles.bars}>
                  <View
                    style={[
                      styles.bar,
                      { backgroundColor: colors.success, height: incomeHeight },
                    ]}
                  />
                  <View
                    style={[
                      styles.bar,
                      {
                        backgroundColor: colors.destructive,
                        height: expenseHeight,
                      },
                    ]}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.label, { color: colors.secondaryText }]}
                >
                  {showLabel ? formatLabel(item.period, granularity) : ""}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: "continuous",
    borderRadius: 18,
    paddingBottom: 12,
    paddingTop: 16,
  },
  emptyCard: {
    alignItems: "center",
    borderRadius: 18,
    padding: 28,
  },
  emptyText: {
    fontSize: 15,
  },
  legend: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 18,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  legendDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  legendText: {
    fontSize: 13,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  chart: {
    alignItems: "flex-end",
    flexDirection: "row",
    height: 158,
    marginTop: 10,
  },
  group: {
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  bars: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 3,
    height: 124,
  },
  bar: {
    borderRadius: 4,
    width: 10,
  },
  label: {
    fontSize: 10,
    marginTop: 6,
    textAlign: "center",
    width: "100%",
  },
});
