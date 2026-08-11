import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity, Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Feather from '@expo/vector-icons/Feather';
import { db } from '@/db';
import { transactions, recurringTransactions, categories, settings } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const [autoBackup, setAutoBackup] = useState(false);

  const handleExport = async () => {
    try {
      // expo-sqlite exposes the DB file; we'll share it
      console.info('[backup.export][stage=locate_db] locating database file');
      const dbDir = FileSystem.documentDirectory + 'SQLite/';
      const dbPath = dbDir + 'expense_tracker.db';
      const fileInfo = await FileSystem.getInfoAsync(dbPath);
      if (!fileInfo.exists) {
        Alert.alert('Export Failed', 'Database file not found');
        return;
      }
      await Sharing.shareAsync(dbPath, {
        UTI: 'public.database',
        mimeType: 'application/x-sqlite3',
      });
      console.info('[backup.export][stage=share_db] database shared');
    } catch (err) {
      console.error('[backup.export][stage=share_db] export failed', { error: String(err) });
      Alert.alert('Export Failed', String(err));
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/x-sqlite3',
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        console.info('[backup.import][stage=pick_db][reason=user_cancelled] import skipped');
        return;
      }

      Alert.alert(
        'Import Database',
        'This will replace your current data. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: async () => {
              try {
                const sourceUri = result.assets[0].uri;
                const targetPath = FileSystem.documentDirectory + 'SQLite/expense_tracker.db';
                console.info('[backup.import][stage=copy_db] copying selected database');
                await FileSystem.copyAsync({ from: sourceUri, to: targetPath });
                console.info('[backup.import][stage=copy_db] database copied');
                Alert.alert('Import Complete', 'Please restart the app.');
              } catch (e) {
                console.error('[backup.import][stage=copy_db] import failed', { error: String(e) });
                Alert.alert('Import Failed', String(e));
              }
            },
          },
        ],
      );
    } catch (err) {
      console.error('[backup.import][stage=pick_db] import failed', { error: String(err) });
      Alert.alert('Import Failed', String(err));
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset All Data',
      'This will delete ALL transactions, recurring rules, and categories. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              console.info('[db.reset][stage=delete_tables] resetting local data');
              await db.delete(transactions).run();
              await db.delete(recurringTransactions).run();
              await db.delete(categories).run();
              await db.delete(settings).run();
              console.info('[db.reset][stage=delete_tables] local data reset');
              router.replace('/migrate');
            } catch (e) {
              console.error('[db.reset][stage=delete_tables] reset failed', { error: String(e) });
              Alert.alert('Reset Failed', String(e));
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Currency</Text>
          <Text style={styles.rowValue}>USD</Text>
      </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Theme</Text>
          <Text style={styles.rowValue}>System</Text>
      </View>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={styles.rowLabel}>Week starts</Text>
          <Text style={styles.rowValue}>Sunday</Text>
      </View>
    </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Auto-backup</Text>
          <Switch value={autoBackup} onValueChange={setAutoBackup} />
      </View>
        <TouchableOpacity style={styles.row} onPress={handleExport}>
          <Text style={styles.rowLabel}>Export Database</Text>
          <Feather name="upload" size={20} color="#007AFF" />
      </TouchableOpacity>
        <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={handleImport}>
          <Text style={styles.rowLabel}>Import Database</Text>
          <Feather name="download" size={20} color="#007AFF" />
      </TouchableOpacity>
    </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={handleReset}>
          <Text style={[styles.rowLabel, { color: '#FF3B30' }]}>Reset All Data</Text>
      </TouchableOpacity>
    </View>
  </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  content: {
    paddingTop: 100,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c8c8cc',
  },
  rowLabel: {
    fontSize: 16,
  },
  rowValue: {
    fontSize: 16,
    color: '#666',
  },
});
