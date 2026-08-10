import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  getRecurringTransaction,
  createRecurringTransaction,
  updateRecurringTransaction,
  RecurringTransaction,
} from '@/db/recurring';
import { db } from '@/db';
import { categories as categoriesTable } from '@/db/schema';
import { validateOccurrence, getNextOccurrences, occurrenceToText } from '@/libs/date';
import { useQueryClient } from '@tanstack/react-query';

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
      const cats = await db.select().from(categoriesTable).all();
      setAvailableCategories(cats);
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    const load = async () => {
      const rt = await getRecurringTransaction(id);
      if (rt) {
        setAmount(String(Math.abs(rt.amount)));
        setDescription(rt.description);
        setCategory(rt.category);
        setRecurrenceValue(rt.recurrenceValue);
        setStartDate(new Date(rt.startDate));
      }
      setLoading(false);
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

      if (!validation.ok) {
        setError(`Invalid cron: ${validation.error}`);
        return;
      }

      if (isEdit && id) {
        const existing = await getRecurringTransaction(id);
        if (!existing) {
          setError('Not found');
          return;
        }
        await updateRecurringTransaction({
          ...existing,
          amount: signedAmount,
          description: description.trim(),
          category: category.trim() || 'Other',
          recurrenceValue: recurrenceValue.trim(),
          startDate: startDate.getTime(),
        });
      } else {
        await createRecurringTransaction({
          amount: signedAmount,
          description: description.trim(),
          category: category.trim() || 'Other',
          recurrenceValue: recurrenceValue.trim(),
          startDate: startDate.getTime(),
          lastCharged: null,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      router.back();
    } catch (err) {
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? 'Edit Recurring' : 'New Recurring'}</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveText}>Save</Text>
      </TouchableOpacity>
    </View>

      <ScrollView style={styles.form}>
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
            <TouchableOpacity
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
          </TouchableOpacity>
          ))}
      </View>
        <TextInput
          style={styles.input}
          value={category}
          onChangeText={setCategory}
          placeholder="Or custom category"
        />

        <Text style={styles.label}>Recurrence</Text>
        <View style={styles.chipsContainer}>
          {CRON_PRESETS.map((p) => (
            <TouchableOpacity
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
          </TouchableOpacity>
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
  </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  cancelText: {
    fontSize: 16,
    color: '#007aff',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007aff',
  },
  form: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 14,
  },
  preview: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
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
