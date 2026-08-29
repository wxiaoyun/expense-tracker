import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Button } from 'react-native';
import { router } from 'expo-router';
import {
  runMigration,
  getLegacyCounts,
  legacyDbExists,
  markMigrationComplete,
  seedPresetCategories,
} from '@/db/migration';
import GlassView from '@/components/glass/GlassView';
import { db } from '@/db';

export default function MigrationScreen() {
  const [status, setStatus] = useState<'checking' | 'found' | 'migrating' | 'success' | 'error' | 'skip'>('checking');
  const [counts, setCounts] = useState<{ transactions: number; recurring: number } | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkLegacy = async () => {
      try {
        console.info('[migration.screen][stage=check_legacy] checking for legacy database');
        if (legacyDbExists()) {
          const legacyCounts = await getLegacyCounts();
          if (!legacyCounts) throw new Error('Could not read legacy database');
          setCounts(legacyCounts);
          setStatus('found');
        } else {
          console.info('[migration.screen][stage=initialize] initializing latest database');
          await seedPresetCategories(db);
          await markMigrationComplete(db);
          router.replace('/(tabs)');
        }
      } catch (checkError) {
        console.error('[migration.screen][stage=check_legacy] migration check failed', {
          error: String(checkError),
        });
        setError(String(checkError));
        setStatus('error');
      }
    };
    void checkLegacy();
  }, []);

  const handleMigrate = async () => {
    setStatus('migrating');
    setProgress('Opening databases...');
    setError(null);

    try {
      console.info('[migration.screen][stage=run_migration] starting legacy migration');
      const result = await runMigration(db);
      if (result.success) {
        setProgress('Migration complete!');
        setStatus('success');
      } else {
        const migrationError = result.error || 'Migration failed';
        console.error('[migration.screen][stage=run_migration] legacy migration failed', {
          error: migrationError,
        });
        setError(migrationError);
        setStatus('error');
      }
    } catch (err) {
      console.error('[migration.screen][stage=run_migration] legacy migration failed', {
        error: String(err),
      });
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
        {
          text: 'Skip',
          style: 'destructive',
          onPress: async () => {
            try {
              await seedPresetCategories(db);
              await markMigrationComplete(db);
              console.info('[migration][stage=skip][reason=user_selected] migration skipped');
              router.replace('/(tabs)');
            } catch (skipError) {
              console.error('[migration][stage=skip] failed to initialize new database', {
                error: String(skipError),
              });
              setError(String(skipError));
              setStatus('error');
            }
          },
        },
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
              <Button title="Skip" onPress={handleSkip} />
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
              <Button title="Skip" onPress={handleSkip} />
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
