import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { MenuView, type NativeActionEvent } from '@react-native-menu/menu';
import { format } from 'date-fns';

import type { TransactionTemplate } from '@/db/schema';
import { getNextOccurrences, occurrenceToText } from '@/libs/date';
import { formatCurrency } from '@/libs/intl';

type TemplateRowProps = {
  template: TransactionTemplate;
  onUse: (id: string) => void;
  onQuickAdd: (id: string) => void;
  onEdit: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  quickAddPending?: boolean;
};

const isQuickAddComplete = (template: TransactionTemplate) =>
  template.amount !== null &&
  Number.isFinite(template.amount) &&
  template.amount > 0 &&
  Boolean(template.description?.trim());

const signedAmount = (template: TransactionTemplate) => {
  if (template.amount === null) return null;
  return template.transactionType === 'income'
    ? Math.abs(template.amount)
    : -Math.abs(template.amount);
};

export function TemplateRow({
  template,
  onUse,
  onQuickAdd,
  onEdit,
  onPause,
  onResume,
  onDelete,
  quickAddPending = false,
}: TemplateRowProps) {
  const scheduled = template.recurrenceValue !== null;
  const paused = scheduled && template.scheduleActive !== 1;
  const amount = signedAmount(template);
  const summary = [
    template.description?.trim() || null,
    template.category?.trim() || null,
    amount === null ? null : formatCurrency(amount),
  ].filter(Boolean).join(' • ') || 'Partial template';
  const nextOccurrence = scheduled && !paused
    ? getNextOccurrences(
      template.recurrenceValue!,
      1,
      new Date(template.scheduleCursorAt ?? template.startDate ?? template.updatedAt),
    )[0]
    : undefined;

  const actions = [
    { id: 'edit', title: 'Edit', image: 'pencil' },
    ...(scheduled ? [{
      id: paused ? 'resume' : 'pause',
      title: paused ? 'Resume' : 'Pause',
      image: paused ? 'play.fill' : 'pause.fill',
    }] : []),
    { id: 'delete', title: 'Delete', image: 'trash', attributes: { destructive: true } },
  ];

  const handleMenuAction = ({ nativeEvent }: NativeActionEvent) => {
    switch (nativeEvent.event) {
      case 'edit':
        onEdit(template.id);
        break;
      case 'pause':
        onPause(template.id);
        break;
      case 'resume':
        onResume(template.id);
        break;
      case 'delete':
        onDelete(template.id);
        break;
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Use ${template.name}`}
          onPress={() => onUse(template.id)}
          style={({ pressed }) => [styles.useArea, pressed && styles.pressed]}
        >
          <View
            accessible
            accessibilityLabel={scheduled ? 'Scheduled template' : 'Manual template'}
            style={styles.iconWrap}
          >
            <Feather name={scheduled ? 'calendar' : 'file-text'} size={18} color="#007AFF" />
          </View>
          <View style={styles.body}>
            <Text numberOfLines={1} style={styles.name}>{template.name}</Text>
            <Text numberOfLines={2} style={styles.summary}>{summary}</Text>
            <View style={styles.statusRow}>
              <Text style={[styles.status, paused && styles.paused]}>
                {scheduled ? paused ? 'Paused' : occurrenceToText(template.recurrenceValue!) : 'Manual'}
              </Text>
              {nextOccurrence ? (
                <Text style={styles.nextOccurrence}>Next {format(nextOccurrence, 'MMM d, yyyy')}</Text>
              ) : null}
            </View>
          </View>
        </Pressable>
        <MenuView actions={actions} onPressAction={handleMenuAction} isAnchoredToRight>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${template.name}`}
            hitSlop={8}
            style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
          >
            <Feather name="more-horizontal" size={22} color="#6E6E73" />
          </Pressable>
        </MenuView>
      </View>
      {isQuickAddComplete(template) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Quick add ${template.name}`}
          accessibilityState={{ disabled: quickAddPending }}
          disabled={quickAddPending}
          onPress={() => onQuickAdd(template.id)}
          style={({ pressed }) => [
            styles.quickAdd,
            (pressed || quickAddPending) && styles.quickAddDisabled,
          ]}
        >
          <Feather name="plus" size={15} color="#007AFF" />
          <Text style={styles.quickAddText}>{quickAddPending ? 'Adding…' : 'Quick Add'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  useArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingLeft: 12,
  },
  name: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  summary: {
    color: '#6E6E73',
    fontSize: 13,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 5,
  },
  status: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  paused: {
    color: '#FF9500',
  },
  nextOccurrence: {
    color: '#6E6E73',
    fontSize: 12,
  },
  moreButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAdd: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginTop: 12,
  },
  quickAddText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  quickAddDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
