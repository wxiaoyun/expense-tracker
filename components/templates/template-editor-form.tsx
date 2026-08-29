import React, { type Dispatch, type RefObject, type SetStateAction } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import type { TemplateSuggestion, TransactionType } from '@/db/template-core';

export const RECURRENCE_PRESETS = [
  { label: 'Daily', value: '0 0 * * *' },
  { label: 'Weekly', value: '0 0 * * 0' },
  { label: 'Monthly', value: '0 0 1 * *' },
  { label: 'Yearly', value: '0 0 1 1 *' },
  { label: 'Weekdays', value: '0 9 * * 1-5' },
] as const;

export const DEFAULT_TEMPLATE_CRON = RECURRENCE_PRESETS[2].value;

export type TemplateEditorCategory = { name: string; icon: string; color: string };

type Props = {
  isEdit: boolean;
  saving: boolean;
  error: string | null;
  suggestedName: string | null;
  suggestions: TemplateSuggestion[];
  availableCategories: TemplateEditorCategory[];
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  amount: string;
  setAmount: Dispatch<SetStateAction<string>>;
  transactionType: TransactionType;
  setTransactionType: Dispatch<SetStateAction<TransactionType>>;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
  category: string;
  setCategory: Dispatch<SetStateAction<string>>;
  notes: string;
  setNotes: Dispatch<SetStateAction<string>>;
  verified: boolean;
  setVerified: Dispatch<SetStateAction<boolean>>;
  repeatAutomatically: boolean;
  recurrenceValue: string;
  setRecurrenceValue: Dispatch<SetStateAction<string>>;
  startDate: Date;
  setStartDate: Dispatch<SetStateAction<Date>>;
  scheduleActive: boolean;
  setScheduleActive: Dispatch<SetStateAction<boolean>>;
  nextOccurrences: Date[];
  visibleBackfillCount: number;
  nameRef: RefObject<TextInput | null>;
  amountRef: RefObject<TextInput | null>;
  descriptionRef: RefObject<TextInput | null>;
  recurrenceRef: RefObject<TextInput | null>;
  onCancel: () => void;
  onSave: () => void;
  onUseSuggestedName: () => void;
  onApplySuggestion: (suggestion: TemplateSuggestion) => void;
  onRepeatChange: (enabled: boolean) => void;
};

export function TemplateEditorForm({
  isEdit,
  saving,
  error,
  suggestedName,
  suggestions,
  availableCategories,
  name,
  setName,
  amount,
  setAmount,
  transactionType,
  setTransactionType,
  description,
  setDescription,
  category,
  setCategory,
  notes,
  setNotes,
  verified,
  setVerified,
  repeatAutomatically,
  recurrenceValue,
  setRecurrenceValue,
  startDate,
  setStartDate,
  scheduleActive,
  setScheduleActive,
  nextOccurrences,
  visibleBackfillCount,
  nameRef,
  amountRef,
  descriptionRef,
  recurrenceRef,
  onCancel,
  onSave,
  onUseSuggestedName,
  onApplySuggestion,
  onRepeatChange,
}: Props) {
  return (
    <View collapsable={false} style={styles.container}>
      <View collapsable={false} style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={12} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{isEdit ? 'Edit Template' : 'New Template'}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          hitSlop={12}
          onPress={onSave}
        >
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text selectable style={styles.errorText}>{error}</Text>
            {suggestedName && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Use suggested name ${suggestedName}`}
                onPress={onUseSuggestedName}
              >
                <Text style={styles.suggestionAction}>Use “{suggestedName}”</Text>
              </Pressable>
            )}
          </View>
        )}

        {suggestions.length > 0 && (
          <View style={styles.suggestionSection}>
            <Text style={styles.sectionLabel}>Suggestions</Text>
            <View style={styles.chipsContainer}>
              {suggestions.map((suggestion) => (
                <Pressable
                  key={`${suggestion.name}-${suggestion.category}-${suggestion.transactionType}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Use suggestion ${suggestion.name}`}
                  style={styles.chip}
                  onPress={() => onApplySuggestion(suggestion)}
                >
                  <Text>{suggestion.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.label}>Template name</Text>
        <TextInput
          ref={nameRef}
          accessibilityLabel="Template name"
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Morning coffee"
        />

        <Text style={styles.label}>Amount</Text>
        <TextInput
          ref={amountRef}
          accessibilityLabel="Template amount"
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <View style={styles.typeRow}>
          {(['expense', 'income'] as const).map((type) => {
            const selected = transactionType === type;
            const label = type === 'income' ? 'Income' : 'Expense';
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityLabel={`Transaction type: ${label}`}
                accessibilityState={{ selected }}
                style={[styles.typeButton, selected && styles.typeButtonSelected]}
                onPress={() => setTransactionType(type)}
              >
                <Text style={[styles.typeButtonText, selected && styles.typeButtonTextSelected]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput
          ref={descriptionRef}
          accessibilityLabel="Template description"
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="What is this for?"
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipsContainer}>
          {availableCategories.map((item) => (
            <Pressable
              key={item.name}
              accessibilityRole="button"
              accessibilityLabel={`Category ${item.name}`}
              accessibilityState={{ selected: category === item.name }}
              style={[
                styles.chip,
                { borderColor: item.color },
                category === item.name && { backgroundColor: `${item.color}20` },
              ]}
              onPress={() => setCategory(item.name)}
            >
              <Text>{item.name}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          accessibilityLabel="Template category"
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="Other"
        />

        <View style={styles.toggleRow}>
          <Text style={styles.label}>Verified</Text>
          <Switch accessibilityLabel="Verified" value={verified} onValueChange={setVerified} />
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          accessibilityLabel="Template notes"
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes"
          multiline
        />

        <View style={styles.toggleRow}>
          <Text style={styles.label}>Repeat automatically</Text>
          <Switch accessibilityLabel="Repeat automatically" value={repeatAutomatically} onValueChange={onRepeatChange} />
        </View>

        {repeatAutomatically && (
          <View style={styles.scheduleSection}>
            <Text style={styles.label}>Presets</Text>
            <View style={styles.chipsContainer}>
              {RECURRENCE_PRESETS.map((preset) => (
                <Pressable
                  key={preset.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Recurrence preset ${preset.label}`}
                  accessibilityState={{ selected: recurrenceValue === preset.value }}
                  style={[styles.chip, recurrenceValue === preset.value && styles.selectedChip]}
                  onPress={() => setRecurrenceValue(preset.value)}
                >
                  <Text style={recurrenceValue === preset.value ? styles.selectedChipText : undefined}>{preset.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Advanced cron</Text>
            <TextInput
              ref={recurrenceRef}
              accessibilityLabel="Cron expression"
              style={styles.input}
              value={recurrenceValue}
              onChangeText={setRecurrenceValue}
              placeholder="0 0 1 * *"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Start date</Text>
            <DateTimePicker
              accessibilityLabel="Template start date"
              value={startDate}
              mode="date"
              display="compact"
              onChange={(_, date) => date && setStartDate(date)}
            />

            <View style={styles.toggleRow}>
              <Text style={styles.label}>Schedule active</Text>
              <Switch accessibilityLabel="Schedule active" value={scheduleActive} onValueChange={setScheduleActive} />
            </View>

            {nextOccurrences.length > 0 && (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>Next 3 occurrences</Text>
                {nextOccurrences.map((date) => (
                  <Text selectable testID="next-occurrence" key={date.getTime()} style={styles.previewText}>
                    {date.toLocaleString()}
                  </Text>
                ))}
              </View>
            )}

            {visibleBackfillCount > 0 && (
              <Text selectable style={styles.backfillText}>
                Saving will create {visibleBackfillCount} past transactions.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: { fontSize: 17, fontWeight: '600' },
  cancelText: { color: '#007AFF', fontSize: 17 },
  saveText: { color: '#007AFF', fontSize: 17, fontWeight: '600' },
  formContent: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  sectionLabel: { color: '#6E6E73', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  suggestionSection: { paddingTop: 16, gap: 8 },
  label: { color: '#6E6E73', fontSize: 13, fontWeight: '500', paddingTop: 8, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    borderCurve: 'continuous',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  typeButtonSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  typeButtonText: { color: '#3C3C43', fontWeight: '600' },
  typeButtonTextSelected: { color: '#FFFFFF' },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectedChip: { borderColor: '#007AFF', backgroundColor: '#E5F1FF' },
  selectedChipText: { color: '#007AFF' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  scheduleSection: { gap: 8 },
  preview: { backgroundColor: '#FFFFFF', borderRadius: 12, borderCurve: 'continuous', padding: 12, gap: 4 },
  previewTitle: { fontWeight: '600' },
  previewText: { color: '#3C3C43', fontVariant: ['tabular-nums'] },
  backfillText: { color: '#B25000', fontWeight: '600', paddingVertical: 8 },
  errorBanner: { backgroundColor: '#FFE5E5', borderRadius: 10, borderCurve: 'continuous', padding: 12, gap: 8 },
  errorText: { color: '#D70015' },
  suggestionAction: { color: '#007AFF', fontWeight: '600' },
});
