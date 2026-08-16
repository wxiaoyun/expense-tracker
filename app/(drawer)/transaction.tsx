import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Switch, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getTransaction, createTransaction, updateTransaction } from '@/db/transaction';
import { db } from '@/db';
import { categories as categoriesTable } from '@/db/schema';
import { useInvalidateTransactions } from '@/hooks/useQueryClient';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function TransactionDrawer() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;
  const invalidateTransactions = useInvalidateTransactions();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [verified, setVerified] = useState(false);
  const [transactionDate, setTransactionDate] = useState(new Date());
  const [availableCategories, setAvailableCategories] = useState<{ name: string; icon: string; color: string }[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await db.select().from(categoriesTable).all();
        setAvailableCategories(cats);
      } catch (err) {
        console.error('[transaction.form][stage=load_categories] category query failed', {
          error: String(err),
        });
      }
    };
    loadCategories();
  }, []);

  // Load existing transaction if editing
  useEffect(() => {
    if (!isEdit || !id) return;
    
    const loadTransaction = async () => {
      try {
        const tx = await getTransaction(id);
        if (tx) {
          setAmount(String(Math.abs(tx.amount)));
          setDescription(tx.description);
          setCategory(tx.category);
          setNotes(tx.notes || '');
          setVerified(tx.verified === 1);
          setTransactionDate(new Date(tx.transactionDate));
        }
      } catch (err) {
        console.error('[transaction.form][stage=load_transaction] transaction query failed', {
          id,
          error: String(err),
        });
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    loadTransaction();
  }, [id, isEdit]);

  const handleSave = async () => {
    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount)) {
        setError('Invalid amount');
        return;
      }

      // Negative = expense, positive = income
      const signedAmount = -Math.abs(parsedAmount);

      if (!description.trim()) {
        setError('Description is required');
        return;
      }

      console.info('[transaction.form][stage=save] saving transaction', {
        mode: isEdit ? 'edit' : 'create',
        id: id ?? null,
        category: category.trim() || 'Other',
      });

      if (isEdit && id) {
        const existing = await getTransaction(id);
        if (!existing) {
          setError('Transaction not found');
          return;
        }
        await updateTransaction({
          ...existing,
          amount: signedAmount,
          description: description.trim(),
          category: category.trim(),
          notes: notes.trim() || null,
          verified: verified ? 1 : 0,
          transactionDate: transactionDate.getTime(),
        });
      } else {
        await createTransaction({
          amount: signedAmount,
          description: description.trim(),
          category: category.trim() || 'Other',
          notes: notes.trim() || null,
          verified: verified ? 1 : 0,
          transactionDate: transactionDate.getTime(),
          recurringTransactionId: null,
        });
      }

      invalidateTransactions();
      router.dismiss();
      console.info('[transaction.form][stage=save] transaction saved', {
        mode: isEdit ? 'edit' : 'create',
        id: id ?? null,
      });
    } catch (err) {
      console.error('[transaction.form][stage=save] transaction save failed', {
        mode: isEdit ? 'edit' : 'create',
        id: id ?? null,
        error: String(err),
      });
      setError(String(err));
    }
  };

  const handleCancel = () => {
    router.dismiss();
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
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
       </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? 'Edit Transaction' : 'New Transaction'}</Text>
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
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="What was this for?"
          placeholderTextColor="#999"
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
          placeholder="Or type custom category"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Date</Text>
        <View style={styles.dateInput}>
          <DateTimePicker
            accessibilityLabel="Transaction date"
            value={transactionDate}
            mode="date"
            display="compact"
            onChange={(_, date) => date && setTransactionDate(date)}
          />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.label}>Verified</Text>
          <Switch
            value={verified}
            onValueChange={setVerified}
            trackColor={{ false: '#767577', true: '#34C759' }}
          />
       </View>

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add any notes..."
          multiline
          placeholderTextColor="#999"
        />
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
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 14,
  },
  dateInput: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  errorBanner: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D70015',
  },
});
