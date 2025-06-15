import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
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
  onEdit: (id: number, onTriggered?: () => void) => void;
  onDelete: (id: number, onTriggered?: () => void) => void;
  onIncur: (id: number, onTriggered?: () => void) => void;
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

  const translateX = useSharedValue(0);
  const isIncome = recurringTransaction.amount > 0;

  const handleEditAction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit(recurringTransaction.id, () => {
      translateX.value = withSpring(0, {
        damping: 30,
        stiffness: 300,
      });
    });
  }, [onEdit, recurringTransaction.id, translateX]);

  const handleDeleteAction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDelete(recurringTransaction.id, () => {
      translateX.value = withSpring(0, {
        damping: 30,
        stiffness: 300,
      });
    });
  }, [onDelete, recurringTransaction.id, translateX]);

  const handleIncurAction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onIncur(recurringTransaction.id, () => {
      translateX.value = withSpring(0, {
        damping: 30,
        stiffness: 300,
      });
    });
  }, [onIncur, recurringTransaction.id, translateX]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .minDistance(10)
    .onUpdate((event) => {
      "worklet";
      // Limit swipe distance to prevent infinite swiping
      const maxSwipe = 180;
      translateX.value = Math.max(
        -maxSwipe,
        Math.min(maxSwipe, event.translationX),
      );
    })
    .onEnd((event) => {
      "worklet";
      const shouldReveal = Math.abs(event.translationX) > 80;

      if (shouldReveal) {
        if (event.translationX > 0) {
          // Swipe right - Edit
          translateX.value = withSpring(120, {
            damping: 30,
            stiffness: 300,
          });
          runOnJS(handleEditAction)();
        } else {
          // Swipe left - Delete
          translateX.value = withSpring(-120, {
            damping: 30,
            stiffness: 300,
          });
          runOnJS(handleDeleteAction)();
        }
      } else {
        translateX.value = withSpring(0, {
          damping: 30,
          stiffness: 300,
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      transform: [{ translateX: translateX.value }],
    };
  }, []);

  const leftActionStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: translateX.value > 0 ? 1 : 0,
    };
  }, []);

  const rightActionStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: translateX.value < 0 ? 1 : 0,
    };
  }, []);

  return (
    <View style={styles.swipeContainer}>
      <Animated.View style={[styles.leftAction, leftActionStyle]}>
        <Feather name="edit-2" size={20} color="white" />
      </Animated.View>

      <Animated.View style={[styles.rightAction, rightActionStyle]}>
        <Feather name="trash-2" size={20} color="white" />
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.recurringTransactionItem,
            { backgroundColor, borderBottomColor: borderColor },
            animatedStyle,
          ]}
        >
          {/* Incur button - tap to create transactions */}
          <TouchableOpacity style={styles.incurButtonContainer} onPress={handleIncurAction}>
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
                  { color: isIncome ? "#34C759" : textColor },
                ]}
              >
                {formatCurrency(recurringTransaction.amount)}
              </ThemedText>
            </View>

            <View style={styles.recurringTransactionDetails}>
              <ThemedText style={[styles.category, { color: textColor + "80" }]}>
                {recurringTransaction.category}
              </ThemedText>
              <ThemedText style={[styles.recurrence, { color: textColor + "60" }]}>
                {occurrenceToText(recurringTransaction.recurrenceValue)}
              </ThemedText>
            </View>

            {recurringTransaction.lastCharged && (
              <ThemedText style={[styles.lastCharged, { color: textColor + "60" }]}>
                Last: {format(new Date(recurringTransaction.lastCharged), "MMM dd, yyyy")}
              </ThemedText>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

type RecurringTransactionHeaderProps = {
  date: string;
}

const RecurringTransactionHeader = ({ date }: RecurringTransactionHeaderProps) => {
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
  onEdit: (id: number, onTriggered?: () => void) => void;
  onDelete: (id: number, onTriggered?: () => void) => void;
  onIncur: (id: number, onTriggered?: () => void) => void;
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
    const grouped = recurringTransactions.reduce((acc, recurringTransaction) => {
      const dateKey = format(new Date(recurringTransaction.startDate), "iii, MMM dd");
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(recurringTransaction);
      return acc;
    }, {} as Record<string, RecurringTransaction[]>);

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
    <View style={[styles.container, { backgroundColor, paddingBottom: bottomTabBarHeight }]}>
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
  swipeContainer: {
    position: "relative",
  },
  leftAction: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  rightAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  recurringTransactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
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
