import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Button } from 'react-native';
import { router } from 'expo-router';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import { runMigration, getLegacyCounts, legacyDbExists } from '@/db/migration';
import { GlassView } from '@/components/glass/GlassView';

export default function MigrationScreen() {
  const [status, setStatus] = useState<'checking' | 'found' | 'migrating' | 'success' | 'error' | 'skip'>('checking');
  const [counts, setCounts] = useState<{ transactions: number; recurring: number } | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkLegacy = async () => {
      if (legacyDbExists()) {
        const counts = await getLegacyCounts();
        setCounts(counts);
        setStatus('found');
      } else {
        // No legacy DB - just seed presets and skip to main app
        const db = drizzle(SQLite.openDatabaseSync('expense_tracker.db', { enableChangeListener: false }));
        const { seedPresetCategories, markMigrationComplete } = await import('@/db/migration');
        await seedPresetCategories(db);
        await markMigrationComplete(db);
        router.replace('/(tabs)');
      }
    };
    checkLegacy();
  }, []);

  const handleMigrate = async () => {
    setStatus('migrating');
    setProgress('Opening databases...');
    setError(null);

    const db = drizzle(SQLite.openDatabaseSync('expense_tracker.db', { enableChangeListener: false }));

    try {
      const result = await runMigration(db);
      if (result.success) {
        setProgress('Migration complete!');
        setStatus('success');
      } else {
        setError(result.error || 'Migration failed');
        setStatus('error');
      }
    } catch (err) {
      setError(String(err));
      setStatus('error');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Migration?',
      'Your existing data will not be imported. You can import it later from Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', style: 'destructive', onPress: () => router.replace('/(tabs)') },
      ]
    );
  };

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  const renderContent = () => {
    switch (status) {
      case 'checking':
        return (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
            <Text style={styles.text}>Checking for existing data...</Text>
          </View>
        );
      case 'found':
        return (
          <View style={styles.container}>
            <Text style={styles.title}>Found Existing Data</Text>
            <View style={styles.stats}>
              <Text style={styles.stat}>
                {counts?.transactions ?? 0} Transactions
              </Text>
              <Text style={styles.stat}>
                {counts?.recurring ?? 0} Recurring
              </Text>
            </View>
            <Text style={styles.description}>
              Would you like to import this data into the new app?
            </Text>
            <View style={styles.buttonRow}>
              <Button title="Import" onPress={handleMigrate} />
              <Button title="Skip" onPress={handleSkip} variant="secondary" />
            </View>
          </View>
        );
      case 'migrating':
        return (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
            <Text style={styles.text}>{progress}</Text>
          </View>
        );
      case 'success':
        return (
          <View style={styles.centered}>
            <Text style={[styles.title, { color: '#34C759' }]}>✓ Migration Complete</Text>
            <Text style={styles.text}>All data imported successfully.</Text>
            <Button title="Continue" onPress={handleContinue} />
          </View>
        );
      case 'error':
        return (
          <View style={styles.centered}>
            <Text style={[styles.title, { color: '#FF3B30' }]}>✗ Migration Failed</Text>
            <Text style={styles.text}>{error}</Text>
            <View style={styles.buttonRow}>
              <Button title="Retry" onPress={handleMigrate} />
              <Button title="Skip" onPress={handleSkip} variant="secondary" />
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <GlassView style={{ flex: 1 }}>
      <View style={styles.safeArea}>
        {renderContent()}
      </View>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  centered: {
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
  },
  stats: {
    flexDirection: 'row',
    gap: 32,
    marginVertical: 16,
  },
  stat: {
    fontSize: 18,
    opacity: 0.8,
  },
  description: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});
