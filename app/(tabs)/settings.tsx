import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '@/db';
import { settings } from '@/db/schema';
import { resetAllData, ResetDataError } from '@/db/reset';
import { setAutoBackup as registerAutoBackup } from '@/libs/background';
import { createLocalBackup, importDatabase, validateSqliteFile } from '@/libs/backup';
import {
  currencyAtom,
  PREFERENCE_KEYS,
  savePreferenceAndApply,
  SUGGESTION_LOOKBACK_OPTIONS,
  suggestionLookbackAtom,
  weekStartAtom,
  type SuggestionLookback,
  type WeekStart,
} from '@/libs/preferences';
import Feather from '@expo/vector-icons/Feather';
import { eq } from 'drizzle-orm';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import {
  reinitializeAppRuntime,
  waitForLaunchTemplateProcessing,
} from '@/libs/app-runtime';
import * as Sharing from 'expo-sharing';
import { useAtom } from 'jotai';
// eslint-disable-next-line import/no-unresolved
import { ContextMenuButton, type MenuConfig } from 'react-native-ios-context-menu';

const CURRENCIES = ['USD', 'SGD', 'EUR', 'GBP', 'JPY', 'CNY'];
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
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <ContextMenuButton
        isMenuPrimaryAction
        menuConfig={menuConfig}
        onPressMenuItem={({ nativeEvent }) => onSelect(nativeEvent.actionKey)}
      >
        <View style={styles.rowValueWrap}>
          <Text style={styles.rowValue}>{valueLabel}</Text>
          <Feather name="chevron-down" size={16} color="#C7C7CC" />
        </View>
      </ContextMenuButton>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [currency, setCurrency] = useAtom(currencyAtom);
  const [weekStart, setWeekStart] = useAtom(weekStartAtom);
  const [suggestionLookback, setSuggestionLookback] = useAtom(suggestionLookbackAtom);
  const [restoring, setRestoring] = useState(false);
  const [autoBackup, setAutoBackup] = useState(() => {
    try {
      console.info('[backup.settings][stage=load] loading backup cadence');
      const row = db.select().from(settings).where(eq(settings.key, 'backup.cadence')).get();
      return row?.value === 'daily';
    } catch (error) {
      console.error('[backup.settings][stage=load] preference load failed', { error: String(error) });
      return false;
    }
  });

  const handleAutoBackup = async (enabled: boolean) => {
    try {
      console.info('[backup.settings][stage=save] saving backup cadence', { enabled });
      await registerAutoBackup(enabled ? 'daily' : null);
      await db.insert(settings).values({ key: 'backup.cadence', value: enabled ? 'daily' : 'off' }).onConflictDoUpdate({ target: settings.key, set: { value: enabled ? 'daily' : 'off' } }).run();
      setAutoBackup(enabled);
    } catch (error) {
      console.error('[backup.settings][stage=save] preference save failed', { enabled, error: String(error) });
      Alert.alert('Auto-backup Failed', String(error));
    }
  };

  const persistPreference = useCallback(async (
    key: string,
    value: string,
    onSaved: () => void,
  ) => {
    try {
      await savePreferenceAndApply(key, value, onSaved);
    } catch (error) {
      console.error('[settings.preference][stage=save] preference update failed', {
        key,
        error: String(error),
      });
      Alert.alert('Preference Not Saved', 'Your previous setting was kept.');
    }
  }, []);

  const changeCurrency = useCallback((value: string) => {
    void persistPreference(PREFERENCE_KEYS.currency, value, () => setCurrency(value));
  }, [persistPreference, setCurrency]);

  const changeWeekStart = useCallback((value: string) => {
    const next = value as WeekStart;
    void persistPreference(PREFERENCE_KEYS.weekStart, next, () => setWeekStart(next));
  }, [persistPreference, setWeekStart]);

  const changeSuggestionLookback = useCallback((value: string) => {
    const next = value as SuggestionLookback;
    void persistPreference(
      PREFERENCE_KEYS.suggestionLookback,
      next,
      () => setSuggestionLookback(next),
    );
  }, [persistPreference, setSuggestionLookback]);

  const handleExport = async () => {
    try {
      console.info('[backup.export][stage=create_snapshot] creating consistent database snapshot');
      const backupPath = await createLocalBackup();
      console.info('[backup.export][stage=share_db] opening database share sheet');
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
      console.info('[backup.import][stage=pick_db] opening document picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
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
                await waitForLaunchTemplateProcessing();
                const recoveryPath = await createLocalBackup();
                console.info('[backup.import][stage=create_recovery] pre-restore snapshot created', { recovery_path: recoveryPath });
                const importResult = await importDatabase(sourceUri);
                console.info('[backup.import][stage=sqlite_backup] database imported', {
                  mode: importResult.mode,
                });
                await reinitializeAppRuntime({ processImportedSchedules: true });
                router.replace('/(tabs)');
                Alert.alert(
                  'Import Complete',
                  importResult.mode === 'migrate'
                    ? 'Legacy database migrated and app data reloaded.'
                    : 'Database restored and app data reloaded.',
                );
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
      'This will delete ALL transactions, templates, and categories. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await waitForLaunchTemplateProcessing();
              await resetAllData();
              await reinitializeAppRuntime();
              router.replace('/migrate');
            } catch (error) {
              const stage = error instanceof ResetDataError ? error.stage : 'unknown';
              console.error('[settings.reset] reset failed', { stage, error: String(error) });
              Alert.alert('Reset Failed', String(error));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
    <ScrollView pointerEvents={restoring ? 'none' : 'auto'} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Settings</Text>
        <Text style={styles.pageSubtitle}>Preferences, backup, and data</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <PreferenceRow
          label="Currency"
          valueLabel={currency}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          onSelect={changeCurrency}
        />
        <PreferenceRow
          label="Week starts"
          valueLabel={WEEK_STARTS.find((w) => w.value === weekStart)?.label ?? 'Sunday'}
          options={WEEK_STARTS}
          onSelect={changeWeekStart}
        />
        <PreferenceRow
          label="Template suggestion history"
          valueLabel={SUGGESTION_LOOKBACK_OPTIONS.find((option) => option.value === suggestionLookback)?.label ?? '3 months'}
          options={[...SUGGESTION_LOOKBACK_OPTIONS]}
          onSelect={changeSuggestionLookback}
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
  pageHeader: {
    marginBottom: 4,
    marginHorizontal: 16,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#000',
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#6E6E73',
    marginTop: 4,
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
    marginBottom: 4,
    marginHorizontal: 16,
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
