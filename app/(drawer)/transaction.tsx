import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Switch, ScrollView } from 'react-native';
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
  const [isIncome, setIsIncome] = useState(false);
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
          setIsIncome(tx.amount > 0);
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

      const signedAmount = isIncome ? Math.abs(parsedAmount) : -Math.abs(parsedAmount);

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
    console.info('[transaction.form][stage=cancel] dismissing transaction form');
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
    <View collapsable={false} style={styles.container}>
      <View collapsable={false} style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={12}
          onPress={handleCancel}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{isEdit ? 'Edit Transaction' : 'New Transaction'}</Text>
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
          placeholderTextColor="#999"
        />

        <View style={styles.typeRow}>
          {(['Expense', 'Income'] as const).map((type) => {
            const selected = isIncome === (type === 'Income');
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                accessibilityLabel={`Transaction type: ${type}`}
                accessibilityState={{ selected }}
                onPress={() => setIsIncome(type === 'Income')}
                style={[styles.typeButton, selected && styles.typeButtonSelected]}
              >
                <Text style={[styles.typeButtonText, selected && styles.typeButtonTextSelected]}>{type}</Text>
              </Pressable>
            );
          })}
        </View>

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
          placeholder="Or type custom category"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Date</Text>
        <DateTimePicker
          accessibilityLabel="Transaction date"
          value={transactionDate}
          mode="date"
          display="compact"
          onChange={(_, date) => date && setTransactionDate(date)}
        />

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
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  typeButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  typeButtonText: {
    color: '#3C3C43',
    fontWeight: '600',
  },
  typeButtonTextSelected: {
    color: '#fff',
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
