import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Transaction } from '@/db/schema';
import { TransactionRow } from './Row';
import { useThemeColor } from '@/hooks/useThemeColor';

type TransactionListProps = {
  transactions: Transaction[];
  onEdit: (id: string) => void;
  onDelete: (id: string, animateDelete: () => Promise<unknown>) => void;
  onToggleVerified: (id: string, verified: boolean) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onEdit,
  onDelete,
  onToggleVerified,
  onLoadMore,
  isLoadingMore,
  refreshing,
  onRefresh,
}) => {
  const backgroundColor = useThemeColor('background');
  const textColor = useThemeColor('text');

  const renderItem = React.useCallback(
    ({ item }: { item: Transaction }) => (
      <TransactionRow
        transaction={item}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleVerified={onToggleVerified}
      />
    ),
    [onEdit, onDelete, onToggleVerified]
  );

  const estimatedItemSize = 88;

  if (transactions.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor }]}>
        <Text style={[styles.emptyTitle, { color: textColor }]}>No Expenses Yet</Text>
        <Text style={[styles.emptySubtitle, { color: textColor, opacity: 0.6 }]}>
          Tap the + button to add your first expense
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={transactions}
      renderItem={renderItem}
      estimatedItemSize={estimatedItemSize}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isLoadingMore && (
          <View style={styles.loadingFooter}>
            <ActivityIndicator size="small" color={textColor} />
          </View>
        )
      }
      refreshControl={
        onRefresh && (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[textColor]}
          />
        )
      }
      style={styles.list}
      contentContainerStyle={styles.contentContainer}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 8,
    paddingBottom: 100, // Space for tab bar
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  loadingFooter: {
    padding: 16,
    alignItems: 'center',
  },
});
