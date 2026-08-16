import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  getRecurringTransaction,
  createRecurringTransaction,
  updateRecurringTransaction,
  incurRecurringTransaction,
} from '@/db/recurring';
import { db } from '@/db';
import { categories as categoriesTable } from '@/db/schema';
import { validateOccurrence, getNextOccurrences } from '@/libs/date';
import { useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';

const CRON_PRESETS = [
  { label: 'Daily', value: '0 0 * * *' },
  { label: 'Weekly', value: '0 0 * * 0' },
  { label: 'Monthly', value: '0 0 1 * *' },
  { label: 'Yearly', value: '0 0 1 1 *' },
  { label: 'Weekdays', value: '0 9 * * 1-5' },
];

export default function RecurringEditDrawer() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [recurrenceValue, setRecurrenceValue] = useState('0 0 1 * *');
  const [startDate, setStartDate] = useState(new Date());
  const [availableCategories, setAvailableCategories] = useState<{ name: string; icon: string; color: string }[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await db.select().from(categoriesTable).all();
        setAvailableCategories(cats);
      } catch (loadError) {
        console.error('[recurring.form][stage=load_categories] category query failed', { error: String(loadError) });
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    const load = async () => {
      try {
        const rt = await getRecurringTransaction(id);
        if (rt) {
          setAmount(String(Math.abs(rt.amount)));
          setDescription(rt.description);
          setCategory(rt.category);
          setRecurrenceValue(rt.recurrenceValue);
          setStartDate(new Date(rt.startDate));
        }
      } catch (loadError) {
        console.error('[recurring.form][stage=load_rule] recurring query failed', { id, error: String(loadError) });
        setError(String(loadError));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  const validation = validateOccurrence(recurrenceValue);
  const nextDates = validation.ok ? getNextOccurrences(recurrenceValue, 3, startDate) : [];

  const handleSave = async () => {
    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        setError('Invalid amount');
        return;
      }
      const signedAmount = -Math.abs(parsedAmount);

      if (!description.trim()) {
        setError('Description is required');
        return;
      }

      if (!validation.ok) {
        setError(`Invalid cron: ${validation.error}`);
        return;
      }

      let savedId: string;
      if (isEdit && id) {
        const existing = await getRecurringTransaction(id);
        if (!existing) {
          setError('Not found');
          return;
        }
        const saved = await updateRecurringTransaction({
          ...existing,
          amount: signedAmount,
          description: description.trim(),
          category: category.trim() || 'Other',
          recurrenceValue: recurrenceValue.trim(),
          startDate: startDate.getTime(),
        });
        if (!saved) throw new Error('Recurring rule update failed');
        savedId = saved.id;
      } else {
        const saved = await createRecurringTransaction({
          amount: signedAmount,
          description: description.trim(),
          category: category.trim() || 'Other',
          recurrenceValue: recurrenceValue.trim(),
          startDate: startDate.getTime(),
          lastCharged: null,
        });
        if (!saved) throw new Error('Recurring rule creation failed');
        savedId = saved.id;
      }

      const incurred = await incurRecurringTransaction(savedId);
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      router.dismiss();
      if (incurred === null) {
        console.error('[recurring.form][stage=catch_up] rule saved but catch-up failed', { id: savedId });
        Alert.alert('Rule Saved', 'Catch-up could not finish and will retry next launch.');
      }
    } catch (err) {
      console.error('[recurring.form][stage=save] recurring save failed', { id: id ?? null, error: String(err) });
      setError(String(err));
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading</Text>
    </View>
    );
  }

  return (
    <View collapsable={false} style={styles.container}>
      <View collapsable={false} style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={12}
          onPress={() => router.dismiss()}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{isEdit ? 'Edit Recurring' : 'New Recurring'}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save"
          hitSlop={12}
          onPress={handleSave}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
    </View>

      <ScrollView
        style={styles.form}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
        </View>
        )}

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Netflix subscription"
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipsContainer}>
          {availableCategories.map((cat) => (
            <Pressable
              key={cat.name}
              style={[
                styles.chip,
                { borderColor: cat.color },
                category === cat.name && { backgroundColor: cat.color + '20' },
              ]}
              onPress={() => setCategory(cat.name)}
            >
              <Text style={[styles.chipText, category === cat.name && { color: cat.color }]}>
                {cat.name}
            </Text>
            </Pressable>
          ))}
      </View>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="Or custom category"
        />

        <Text style={styles.label}>Start Date</Text>
        <DateTimePicker
          accessibilityLabel="Recurring start date"
          value={startDate}
          mode="date"
          display="compact"
          onChange={(_, date) => date && setStartDate(date)}
        />

        <Text style={styles.label}>Recurrence</Text>
        <View style={styles.chipsContainer}>
          {CRON_PRESETS.map((p) => (
            <Pressable
              key={p.value}
              style={[
                styles.chip,
                recurrenceValue === p.value && { backgroundColor: '#007AFF20', borderColor: '#007AFF' },
              ]}
              onPress={() => setRecurrenceValue(p.value)}
            >
              <Text style={[styles.chipText, recurrenceValue === p.value && { color: '#007AFF' }]}>
                {p.label}
            </Text>
            </Pressable>
          ))}
      </View>

        <TextInput
          style={[styles.input, validation.ok ? null : styles.inputError]}
          value={recurrenceValue}
          onChangeText={setRecurrenceValue}
          placeholder="Cron expression (e.g. 0 0 1 * *)"
        />
        {!validation.ok && (
          <Text style={styles.errorText}>{validation.error}</Text>
        )}

        {validation.ok && nextDates.length > 0 && (
          <View style={styles.preview}>
            <Text style={styles.label}>Next 3 charges</Text>
            {nextDates.map((d, i) => (
              <Text key={i} style={styles.previewText}>
                • {d.toLocaleDateString()} at {d.toLocaleTimeString()}
            </Text>
            ))}
        </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  cancelText: {
    fontSize: 17,
    color: '#007AFF',
  },
  saveText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  form: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
    color: '#6E6E73',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
  },
  preview: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  previewText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  errorBanner: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D70015',
    fontSize: 14,
    marginTop: 4,
  },
});
