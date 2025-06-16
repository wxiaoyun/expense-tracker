import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { Checkbox } from "expo-checkbox";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
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
import { Transaction } from "@/db/schema";
import { useThemeColor } from "@/hooks/useThemeColor";
import { formatCurrency } from "@/libs/intl";
import Feather from "@expo/vector-icons/Feather";
import { Colors } from "@/constants/Colors";

type ListItem = {
  type: "header" | "transaction";
  date?: string;
  transaction?: Transaction;
  id: string;
};

type SwipeableTransactionProps = {
  transaction: Transaction;
  onToggleVerified: (id: number, verified: boolean) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number, animateDelete: () => Promise<unknown>) => void;
}

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
    }
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
    }
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

const SwipeableTransaction = ({
  transaction,
  onToggleVerified,
  onEdit,
  onDelete,
}: SwipeableTransactionProps) => {
  const textColor = useThemeColor("text");
  const backgroundColor = useThemeColor("background");
  const borderColor = useThemeColor("text") + "20";

  const reanimatedRef = useRef<SwipeableMethods>(null);
  const heightAnim = useSharedValue(70);
  const opacityAnim = useSharedValue(1);
  const isVerified = transaction.verified === 1;
  const isIncome = transaction.amount > 0;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: heightAnim.value,
      opacity: opacityAnim.value,
    };
  });

  const handleToggleVerifiedAction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleVerified(transaction.id, !isVerified);
  }, [onToggleVerified, transaction.id, isVerified]);

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
    })
  }, [heightAnim, opacityAnim]);

  const onSwipeableLeftOpen = () => {
    reanimatedRef.current?.close();
    // Left swipe exposes right action (delete)
    onDelete(transaction.id, animateDelete);
  };

  const onSwipeableRightOpen = () => {
    reanimatedRef.current?.close();
    // Right swipe exposes left action (edit)
    onEdit(transaction.id);
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
          if (direction === 'left') {
            onSwipeableLeftOpen();
          } else {
            onSwipeableRightOpen();
          }
        }}
      >
        <View
          style={[
            styles.transactionItem,
            { backgroundColor, borderBottomColor: borderColor },
          ]}
        >
          <Checkbox
            value={isVerified}
            onValueChange={handleToggleVerifiedAction}
            style={styles.checkbox}
            color={isVerified ? Colors.dark.info : undefined}
          />

          <View style={styles.transactionContent}>
            <View style={styles.transactionMain}>
              <ThemedText style={styles.description}>
                {transaction.description || "No description"}
              </ThemedText>
              <ThemedText
                style={[
                  styles.amount,
                  { color: isIncome ? Colors.light.success : textColor },
                ]}
              >
                {formatCurrency(transaction.amount)}
              </ThemedText>
            </View>

            <ThemedText style={[styles.category, { color: textColor + "80" }]}>
              {transaction.category}
            </ThemedText>
          </View>
        </View>
      </ReanimatedSwipeable>
    </Reanimated.View>
  );
};

type TransactionHeaderProps = {
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
  onEdit: (id: number) => void;
  onDelete: (id: number, animateDelete: () => Promise<unknown>) => void;
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
      const dateKey = format(new Date(transaction.transactionDate), "iii, MMM dd");
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
        estimatedItemSize={70}
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
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 70,
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
