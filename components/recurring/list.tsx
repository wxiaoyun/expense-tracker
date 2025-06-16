import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { RecurringTransaction } from "@/db/schema";
import { useThemeColor } from "@/hooks/useThemeColor";
import { occurrenceToText } from "@/libs/date";
import { formatCurrency } from "@/libs/intl";
import Feather from "@expo/vector-icons/Feather";

type ListItem = {
  type: "header" | "recurring-transaction";
  date?: string;
  recurringTransaction?: RecurringTransaction;
  id: string;
};

type SwipeableRecurringTransactionProps = {
  recurringTransaction: RecurringTransaction;
  onEdit: (id: number) => void;
  onDelete: (id: number, animateDelete: () => Promise<unknown>) => void;
  onIncur: (id: number) => void;
};

function LeftAction(prog: SharedValue<number>, drag: SharedValue<number>) {
  const hasReachedThresholdUp = useSharedValue(false);
  const hasReachedThresholdDown = useSharedValue(false);

  useAnimatedReaction(
    () => {
      return drag.value;
    },
    (dragValue) => {
      if (Math.abs(dragValue) > 80 && !hasReachedThresholdUp.value) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        hasReachedThresholdUp.value = true;
        hasReachedThresholdDown.value = false;
      } else if (Math.abs(dragValue) < 80 && !hasReachedThresholdDown.value) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        hasReachedThresholdDown.value = true;
        hasReachedThresholdUp.value = false;
      }
    },
  );

  const animatedStyle = useAnimatedStyle(() => {
    if (Math.abs(drag.value) > 80) {
      return {
        backgroundColor: Colors.light.info,
      };
    }
    return {
      backgroundColor: Colors.dark.info,
    };
  });

  return (
    <Reanimated.View style={[{ flex: 1 }]}>
      <Reanimated.View style={[styles.leftAction, animatedStyle]}>
        <Feather name="edit-2" size={20} color="white" />
      </Reanimated.View>
    </Reanimated.View>
  );
}

function RightAction(prog: SharedValue<number>, drag: SharedValue<number>) {
  const hasReachedThresholdUp = useSharedValue(false);
  const hasReachedThresholdDown = useSharedValue(false);

  useAnimatedReaction(
    () => {
      return drag.value;
    },
    (dragValue) => {
      if (Math.abs(dragValue) > 80 && !hasReachedThresholdUp.value) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        hasReachedThresholdUp.value = true;
        hasReachedThresholdDown.value = false;
      } else if (Math.abs(dragValue) < 80 && !hasReachedThresholdDown.value) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        hasReachedThresholdDown.value = true;
        hasReachedThresholdUp.value = false;
      }
    },
  );

  const animatedStyle = useAnimatedStyle(() => {
    if (Math.abs(drag.value) > 80) {
      return {
        backgroundColor: Colors.dark.destructive,
      };
    }
    return {
      backgroundColor: Colors.light.destructive,
    };
  });

  return (
    <Reanimated.View style={[{ flex: 1 }]}>
      <Reanimated.View style={[styles.rightAction, animatedStyle]}>
        <Feather name="trash-2" size={20} color="white" />
      </Reanimated.View>
    </Reanimated.View>
  );
}

const SwipeableRecurringTransaction = ({
  recurringTransaction,
  onEdit,
  onDelete,
  onIncur,
}: SwipeableRecurringTransactionProps) => {
  const textColor = useThemeColor("text");
  const backgroundColor = useThemeColor("background");
  const borderColor = useThemeColor("text") + "20";

  const reanimatedRef = useRef<SwipeableMethods>(null);
  const heightAnim = useSharedValue(80);
  const opacityAnim = useSharedValue(1);
  const isIncome = recurringTransaction.amount > 0;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: heightAnim.value,
      opacity: opacityAnim.value,
    };
  });

  const handleIncurAction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onIncur(recurringTransaction.id);
  }, [onIncur, recurringTransaction.id]);

  const animateDelete = useCallback(() => {
    return new Promise((resolve) => {
      // Animate out before deletion
      heightAnim.value = withTiming(0, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
      opacityAnim.value = withTiming(0, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });

      setTimeout(() => {
        resolve(true);
      }, 300);
    });
  }, [heightAnim, opacityAnim]);

  const onSwipeableLeftOpen = () => {
    reanimatedRef.current?.close();
    // Left swipe exposes right action (delete)
    onDelete(recurringTransaction.id, animateDelete);
  };

  const onSwipeableRightOpen = () => {
    reanimatedRef.current?.close();
    // Right swipe exposes left action (edit)
    onEdit(recurringTransaction.id);
  };

  return (
    <Reanimated.View style={animatedStyle}>
      <ReanimatedSwipeable
        ref={reanimatedRef}
        containerStyle={[styles.swipeableContainer, { backgroundColor }]}
        friction={2}
        enableTrackpadTwoFingerGesture
        leftThreshold={40}
        rightThreshold={40}
        renderLeftActions={LeftAction}
        renderRightActions={RightAction}
        onSwipeableWillOpen={(direction) => {
          if (direction === "left") {
            onSwipeableLeftOpen();
          } else {
            onSwipeableRightOpen();
          }
        }}
      >
        <View
          style={[
            styles.recurringTransactionItem,
            { backgroundColor, borderBottomColor: borderColor },
          ]}
        >
          {/* Incur button - tap to create transactions */}
          <TouchableOpacity
            style={styles.incurButtonContainer}
            onPress={handleIncurAction}
          >
            <Feather
              name="play"
              size={16}
              color={textColor}
              style={styles.incurButton}
            />
          </TouchableOpacity>

          <View style={styles.recurringTransactionContent}>
            <View style={styles.recurringTransactionMain}>
              <ThemedText style={styles.description}>
                {recurringTransaction.description || "No description"}
              </ThemedText>
              <ThemedText
                style={[
                  styles.amount,
                  { color: isIncome ? Colors.light.success : textColor },
                ]}
              >
                {formatCurrency(recurringTransaction.amount)}
              </ThemedText>
            </View>

            <View style={styles.recurringTransactionDetails}>
              <ThemedText
                style={[styles.category, { color: textColor + "80" }]}
              >
                {recurringTransaction.category}
              </ThemedText>
              <ThemedText
                style={[styles.recurrence, { color: textColor + "60" }]}
              >
                {occurrenceToText(recurringTransaction.recurrenceValue)}
              </ThemedText>
            </View>

            {recurringTransaction.lastCharged && (
              <ThemedText
                style={[styles.lastCharged, { color: textColor + "60" }]}
              >
                Last:{" "}
                {format(
                  new Date(recurringTransaction.lastCharged),
                  "MMM dd, yyyy",
                )}
              </ThemedText>
            )}
          </View>
        </View>
      </ReanimatedSwipeable>
    </Reanimated.View>
  );
};

type RecurringTransactionHeaderProps = {
  date: string;
};

const RecurringTransactionHeader = ({
  date,
}: RecurringTransactionHeaderProps) => {
  const textColor = useThemeColor("text");

  return (
    <View style={styles.headerContainer}>
      <ThemedText style={[styles.headerText, { color: textColor }]}>
        {date}
      </ThemedText>
    </View>
  );
};

type RecurringTransactionListProps = {
  recurringTransactions: RecurringTransaction[];
  onEdit: (id: number) => void;
  onDelete: (id: number, animateDelete: () => Promise<unknown>) => void;
  onIncur: (id: number) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
};

export const RecurringTransactionList = ({
  recurringTransactions,
  onEdit,
  onDelete,
  onIncur,
  onLoadMore,
  isLoadingMore,
}: RecurringTransactionListProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  const backgroundColor = useThemeColor("background");
  const textColor = useThemeColor("text");

  const groupedData = useMemo(() => {
    const grouped = recurringTransactions.reduce(
      (acc, recurringTransaction) => {
        const dateKey = format(
          new Date(recurringTransaction.startDate),
          "iii, MMM dd",
        );
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(recurringTransaction);
        return acc;
      },
      {} as Record<string, RecurringTransaction[]>,
    );

    const flatData: ListItem[] = [];
    Object.entries(grouped).forEach(([date, recurringTransactions]) => {
      flatData.push({
        type: "header",
        date,
        id: `header-${date}`,
      });

      recurringTransactions.forEach((recurringTransaction) => {
        flatData.push({
          type: "recurring-transaction",
          recurringTransaction,
          id: `recurring-transaction-${recurringTransaction.id}`,
        });
      });
    });

    return flatData;
  }, [recurringTransactions]);

  const getItemType = useCallback((item: ListItem) => {
    return item.type;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === "header") {
        return <RecurringTransactionHeader date={item.date!} />;
      }

      return (
        <SwipeableRecurringTransaction
          recurringTransaction={item.recurringTransaction!}
          onEdit={onEdit}
          onDelete={onDelete}
          onIncur={onIncur}
        />
      );
    },
    [onEdit, onDelete, onIncur],
  );

  const keyExtractor = useCallback((item: ListItem) => item.id, []);

  const handleEndReached = useCallback(() => {
    if (onLoadMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [onLoadMore, isLoadingMore]);

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;

    return (
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color={textColor} />
        <ThemedText style={styles.footerText}>Loading more...</ThemedText>
      </View>
    );
  }, [isLoadingMore, textColor]);

  const renderEmptyState = useCallback(() => {
    return (
      <View style={styles.emptyContainer}>
        <Feather name="repeat" size={48} color={textColor + "40"} />
        <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
          No recurring transactions found
        </ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: textColor + "80" }]}>
          Your recurring transactions will appear here
        </ThemedText>
      </View>
    );
  }, [textColor]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor, paddingBottom: bottomTabBarHeight },
      ]}
    >
      <FlashList
        contentInsetAdjustmentBehavior="automatic"
        data={groupedData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        estimatedItemSize={80}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "transparent",
  },
  headerText: {
    fontSize: 18,
    fontWeight: "600",
  },
  swipeableContainer: {
    backgroundColor: "transparent",
  },
  leftAction: {
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    flex: 1,
  },
  rightAction: {
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    flex: 1,
  },
  recurringTransactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 80,
  },
  incurButtonContainer: {
    marginRight: 12,
  },
  incurButton: {
    padding: 8,
  },
  recurringTransactionContent: {
    flex: 1,
  },
  recurringTransactionMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  description: {
    fontSize: 16,
    flex: 1,
    marginRight: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: "500",
  },
  recurringTransactionDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    opacity: 0.6,
  },
  recurrence: {
    fontSize: 10,
    opacity: 0.5,
  },
  lastCharged: {
    fontSize: 10,
    opacity: 0.5,
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  footerText: {
    marginLeft: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
  },
});
