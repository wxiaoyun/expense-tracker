import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Transaction } from '@/db/schema';
import { TransactionRow } from './Row';
import { useThemeColor } from '@/hooks/useThemeColor';

type TransactionListProps = {
  transactions: Transaction[];
  activeTemplateIds: ReadonlySet<string>;
  onEdit: (id: string) => void;
  onSaveAsTemplate: (id: string) => void;
  onViewTemplate: (templateId: string) => void;
  onDelete: (id: string) => void;
  onToggleVerified: (id: string, verified: boolean) => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
};

const renderFooter = (isLoadingMore: boolean, textColor: string) => {
  if (!isLoadingMore) return null;
  return (
    <View style={styles.loadingFooter}>
      <ActivityIndicator size="small" color={textColor} />
    </View>
  );
};

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  activeTemplateIds,
  onEdit,
  onSaveAsTemplate,
  onViewTemplate,
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
        hasActiveTemplate={Boolean(item.templateId && activeTemplateIds.has(item.templateId))}
        onEdit={onEdit}
        onSaveAsTemplate={onSaveAsTemplate}
        onViewTemplate={onViewTemplate}
        onDelete={onDelete}
        onToggleVerified={onToggleVerified}
      />
    ),
    [activeTemplateIds, onEdit, onSaveAsTemplate, onViewTemplate, onDelete, onToggleVerified]
  );

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
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={renderFooter(isLoadingMore ?? false, textColor)}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={textColor}
          />
        ) : undefined
      }
      contentContainerStyle={styles.contentContainer}
    />
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    paddingTop: 8,
    paddingBottom: 100,
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
