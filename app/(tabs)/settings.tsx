import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity, Alert, ActivityIndicator, Appearance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// eslint-disable-next-line import/no-unresolved
import { ContextMenuButton, type MenuConfig } from 'react-native-ios-context-menu';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import Feather from '@expo/vector-icons/Feather';
import { db } from '@/db';
import { transactions, recurringTransactions, categories, settings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { router } from 'expo-router';
import { setAutoBackup as registerAutoBackup } from '@/libs/background';
import { createLocalBackup, restoreDatabase, validateSqliteFile } from '@/libs/backup';
import { useQueryClient } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { currencyAtom, themeAtom, weekStartAtom, savePreference, type ThemePreference, type WeekStart } from '@/libs/preferences';

const CURRENCIES = ['USD', 'SGD', 'EUR', 'GBP', 'JPY', 'CNY'];
const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
const WEEK_STARTS: { value: WeekStart; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

type PickerOption = { value: string; label: string };

function PreferenceRow({
  label,
  valueLabel,
  options,
  onSelect,
  last,
}: {
  label: string;
  valueLabel: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
  last?: boolean;
}) {
  const menuConfig: MenuConfig = {
    menuTitle: label,
    menuItems: options.map((option) => ({
      actionKey: option.value,
      actionTitle: option.label,
      menuState: option.value === valueLabel || option.label === valueLabel ? 'on' : 'off',
    })),
  };

  return (
    <ContextMenuButton
      isMenuPrimaryAction
      menuConfig={menuConfig}
      onPressMenuItem={({ nativeEvent }) => onSelect(nativeEvent.actionKey)}
    >
      <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.rowValueWrap}>
          <Text style={styles.rowValue}>{valueLabel}</Text>
          <Feather name="chevron-down" size={16} color="#C7C7CC" />
        </View>
      </View>
    </ContextMenuButton>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useAtom(currencyAtom);
  const [theme, setTheme] = useAtom(themeAtom);
  const [weekStart, setWeekStart] = useAtom(weekStartAtom);
  const [restoring, setRestoring] = useState(false);
  const [autoBackup, setAutoBackup] = useState(() => {
    try {
      const row = db.select().from(settings).where(eq(settings.key, 'backup.cadence')).get();
      return row?.value === 'daily';
    } catch (error) {
      console.error('[backup.settings][stage=load] preference load failed', { error: String(error) });
      return false;
    }
  });

  const handleAutoBackup = async (enabled: boolean) => {
    try {
      await registerAutoBackup(enabled ? 'daily' : null);
      await db.insert(settings).values({ key: 'backup.cadence', value: enabled ? 'daily' : 'off' }).onConflictDoUpdate({ target: settings.key, set: { value: enabled ? 'daily' : 'off' } }).run();
      setAutoBackup(enabled);
    } catch (error) {
      console.error('[backup.settings][stage=save] preference save failed', { enabled, error: String(error) });
      Alert.alert('Auto-backup Failed', String(error));
    }
  };

  const applyTheme = useCallback((value: string) => {
    const next = value as ThemePreference;
    setTheme(next);
    savePreference('pref.theme', next).catch(() => {});
    Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
  }, [setTheme]);

  const changeCurrency = useCallback((value: string) => {
    setCurrency(value);
    savePreference('pref.currency', value).catch(() => {});
  }, [setCurrency]);

  const changeWeekStart = useCallback((value: string) => {
    const next = value as WeekStart;
    setWeekStart(next);
    savePreference('pref.week_start', next).catch(() => {});
  }, [setWeekStart]);

  const handleExport = async () => {
    try {
      console.info('[backup.export][stage=create_snapshot] creating consistent database snapshot');
      const backupPath = await createLocalBackup();
      await Sharing.shareAsync(backupPath, {
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

      await validateSqliteFile(result.assets[0].uri);

      Alert.alert(
        'Import Database',
        'This will replace your current data. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: async () => {
              setRestoring(true);
              try {
                const sourceUri = result.assets[0].uri;
                const recoveryPath = await createLocalBackup();
                console.info('[backup.import][stage=create_recovery] pre-restore snapshot created', { recovery_path: recoveryPath });
                await restoreDatabase(sourceUri);
                console.info('[backup.import][stage=sqlite_backup] database restored');
                queryClient.clear();
                router.replace('/(tabs)');
                Alert.alert('Import Complete', 'Database restored and app data reloaded.');
              } catch (e) {
                console.error('[backup.import][stage=copy_db] import failed', { error: String(e) });
                Alert.alert('Import Failed', String(e));
              } finally {
                setRestoring(false);
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
    <View style={styles.container}>
    <ScrollView pointerEvents={restoring ? 'none' : 'auto'} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <PreferenceRow
          label="Currency"
          valueLabel={currency}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          onSelect={changeCurrency}
        />
        <PreferenceRow
          label="Theme"
          valueLabel={THEMES.find((t) => t.value === theme)?.label ?? 'System'}
          options={THEMES}
          onSelect={applyTheme}
        />
        <PreferenceRow
          label="Week starts"
          valueLabel={WEEK_STARTS.find((w) => w.value === weekStart)?.label ?? 'Sunday'}
          options={WEEK_STARTS}
          onSelect={changeWeekStart}
          last
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Auto-backup</Text>
          <Switch value={autoBackup} onValueChange={handleAutoBackup} accessibilityLabel="Daily auto-backup" />
      </View>
        <TouchableOpacity style={styles.row} onPress={async () => {
          try {
            const path = await createLocalBackup();
            Alert.alert('Backup Created', path);
          } catch (error) {
            console.error('[backup.settings][stage=create_now] backup failed', { error: String(error) });
            Alert.alert('Backup Failed', String(error));
          }
        }}>
          <Text style={styles.rowLabel}>Back Up Now</Text>
          <Feather name="database" size={20} color="#007AFF" />
      </TouchableOpacity>
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
    {restoring && <View style={styles.restoreOverlay}><ActivityIndicator size="large" /><Text style={styles.restoreText}>Restoring database</Text></View>}
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  restoreOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(242,242,247,0.86)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restoreText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    paddingTop: 24,
    paddingBottom: 32,
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
  rowValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
