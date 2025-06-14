import { ThemedText } from "@/components/ThemedText";
import { Transaction } from "@/db/schema";
import { useThemeColor } from "@/hooks/useThemeColor";
import { formatDate } from "@/libs/date";
import { formatCurrency } from "@/libs/intl";
import Feather from "@expo/vector-icons/Feather";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { FlashList } from "@shopify/flash-list";
import { Checkbox } from "expo-checkbox";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";


type ListItem = {
  type: "header" | "transaction";
  date?: string;
  transaction?: Transaction;
  id: string;
};

interface SwipeableTransactionProps {
  transaction: Transaction;
  onToggleVerified: (id: number, verified: boolean) => void;
  onEdit: (id: number, onTriggered?: () => void) => void;
  onDelete: (id: number, onTriggered?: () => void) => void;
}

const SwipeableTransaction = ({
  transaction,
  onToggleVerified,
  onEdit,
  onDelete,
}: SwipeableTransactionProps) => {
  const textColor = useThemeColor("text");
  const backgroundColor = useThemeColor("background");
  const borderColor = useThemeColor("text") + "20"; // Use text color with opacity for border

  const translateX = useSharedValue(0);
  const isVerified = transaction.verified === 1;
  const isIncome = transaction.amount > 0;

  const handleEditAction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onEdit(transaction.id, () => {
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      });
    });
  }, [onEdit, transaction.id, translateX]);

  const handleDeleteAction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete(transaction.id, () => {
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      });
    });
  }, [onDelete, transaction.id, translateX]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .minDistance(10)
    .onUpdate((event) => {
      "worklet";
      // Limit swipe distance to prevent infinite swiping
      const maxSwipe = 150;
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
            damping: 20,
            stiffness: 300,
          });
          runOnJS(handleEditAction)();
        } else {
          // Swipe left - Delete
          translateX.value = withSpring(-120, {
            damping: 20,
            stiffness: 300,
          });
          runOnJS(handleDeleteAction)();
        }
      } else {
        translateX.value = withSpring(0, {
          damping: 20,
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
            styles.transactionItem,
            { backgroundColor, borderBottomColor: borderColor },
            animatedStyle,
          ]}
        >
          <Checkbox
            value={isVerified}
            onValueChange={(value) => onToggleVerified(transaction.id, value)}
            style={styles.checkbox}
            color={isVerified ? "#007AFF" : undefined}
          />

          <View style={styles.transactionContent}>
            <View style={styles.transactionMain}>
              <ThemedText style={styles.description}>
                {transaction.description || "No description"}
              </ThemedText>
              <ThemedText
                style={[
                  styles.amount,
                  { color: isIncome ? "#34C759" : textColor },
                ]}
              >
                {formatCurrency(transaction.amount)}
              </ThemedText>
            </View>

            <ThemedText style={[styles.category, { color: textColor + "80" }]}>
              {transaction.category}
            </ThemedText>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

interface TransactionHeaderProps {
  date: string;
}

const TransactionHeader = ({ date }: TransactionHeaderProps) => {
  const textColor = useThemeColor("text");

  return (
    <View style={styles.headerContainer}>
      <ThemedText style={[styles.headerText, { color: textColor }]}>
        {date}
      </ThemedText>
    </View>
  );
};

type TransactionListProps = {
  transactions: Transaction[];
  onEdit: (id: number, onTriggered?: () => void) => void;
  onDelete: (id: number, onTriggered?: () => void) => void;
  onToggleVerified: (id: number, verified: boolean) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
};

export const TransactionList = ({
  transactions,
  onEdit,
  onDelete,
  onToggleVerified,
  onLoadMore,
  isLoadingMore,
}: TransactionListProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  const backgroundColor = useThemeColor("background");
  const textColor = useThemeColor("text");

  const groupedData = useMemo(() => {
    const grouped = transactions.reduce((acc, transaction) => {
      const dateKey = formatDate(transaction.transactionDate);
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(transaction);
      return acc;
    }, {} as Record<string, Transaction[]>);

    const flatData: ListItem[] = [];
    Object.entries(grouped).forEach(([date, transactions]) => {
      flatData.push({
        type: "header",
        date,
        id: `header-${date}`,
      });

      transactions.forEach((transaction) => {
        flatData.push({
          type: "transaction",
          transaction,
          id: `transaction-${transaction.id}`,
        });
      });
    });

    return flatData;
  }, [transactions]);

  const getItemType = useCallback((item: ListItem) => {
    return item.type;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === "header") {
        return <TransactionHeader date={item.date!} />;
      }

      return (
        <SwipeableTransaction
          transaction={item.transaction!}
          onToggleVerified={onToggleVerified}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      );
    },
    [onToggleVerified, onEdit, onDelete],
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
        <Feather name="inbox" size={48} color={textColor + "40"} />
        <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
          No transactions found
        </ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: textColor + "80" }]}>
          Your transactions will appear here
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
        estimatedItemSize={60}
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
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  checkbox: {
    marginRight: 12,
    borderRadius: 12,
  },
  transactionContent: {
    flex: 1,
  },
  transactionMain: {
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
  category: {
    fontSize: 12,
    opacity: 0.6,
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
