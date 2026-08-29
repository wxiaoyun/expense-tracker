import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text as RNText, View } from 'react-native';
import {
  Button,
  Column,
  FieldGroup,
  Host,
  Picker,
  Row,
  Spacer,
  Switch,
  Text,
} from '@expo/ui';
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
import { eq } from 'drizzle-orm';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import {
  reinitializeAppRuntime,
  waitForLaunchTemplateProcessing,
} from '@/libs/app-runtime';
import * as Sharing from 'expo-sharing';
import { useAtom } from 'jotai';

const CURRENCIES = ['USD', 'SGD', 'EUR', 'GBP', 'JPY', 'CNY'];
const WEEK_STARTS: { value: WeekStart; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

type PickerOption = { value: string; label: string };

function PreferenceRow({
  label,
  selectedValue,
  options,
  onSelect,
}: {
  label: string;
  selectedValue: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
}) {
  const testIdSuffix = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <Row alignment="center" spacing={12} testID={`preference-${testIdSuffix}`}>
      <Text textStyle={{ fontSize: 16, color: '#000' }}>{label}</Text>
      <Spacer flexible />
      <Picker
        selectedValue={selectedValue}
        onValueChange={onSelect}
        testID={`picker-${testIdSuffix}`}
      >
        {options.map((option) => (
          <Picker.Item key={option.value} label={option.label} value={option.value} />
        ))}
      </Picker>
    </Row>
  );
}

export default function SettingsScreen() {
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
      Alert.alert('Auto backup failed', String(error));
    }
  };

  const handleBackupNow = async () => {
    try {
      await createLocalBackup();
      console.info('[backup.settings][stage=create_now] backup created');
      Alert.alert('Backup created');
    } catch (error) {
      console.error('[backup.settings][stage=create_now] backup failed', { error: String(error) });
      Alert.alert('Backup failed', String(error));
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
      Alert.alert('Export failed', String(err));
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
        'Import database',
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
                  'Import complete',
                  importResult.mode === 'migrate'
                    ? 'Legacy database migrated and app data reloaded.'
                    : 'Database restored and app data reloaded.',
                );
              } catch (e) {
                console.error('[backup.import][stage=copy_db] import failed', { error: String(e) });
                Alert.alert('Import failed', String(e));
              } finally {
                setRestoring(false);
              }
            },
          },
        ],
      );
    } catch (err) {
      console.error('[backup.import][stage=pick_db] import failed', { error: String(err) });
      Alert.alert('Import failed', String(err));
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset all data',
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
              Alert.alert('Reset failed', String(error));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Host style={{ flex: 1 }}>
        <FieldGroup>
          <Column style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            <Text textStyle={{ fontSize: 34, fontWeight: '700', color: '#000' }}>Settings</Text>
            <Text textStyle={{ fontSize: 15, color: '#6E6E73' }}>Preferences, backup, and data</Text>
          </Column>

          <FieldGroup.Section title="Preferences">
            <PreferenceRow
              label="Currency"
              selectedValue={currency}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              onSelect={changeCurrency}
            />
            <PreferenceRow
              label="Week starts"
              selectedValue={weekStart}
              options={WEEK_STARTS}
              onSelect={changeWeekStart}
            />
            <PreferenceRow
              label="Template suggestion history"
              selectedValue={suggestionLookback}
              options={[...SUGGESTION_LOOKBACK_OPTIONS]}
              onSelect={changeSuggestionLookback}
            />
          </FieldGroup.Section>

          <FieldGroup.Section title="Backup">
            <Switch
              label="Auto backup"
              value={autoBackup}
              onValueChange={handleAutoBackup}
              testID="auto-backup"
            />
            <Button label="Back up now" onPress={handleBackupNow} variant="text" testID="backup-now" />
            <Button label="Export database" onPress={handleExport} variant="text" testID="export-database" />
            <Button label="Import database" onPress={handleImport} variant="text" testID="import-database" />
          </FieldGroup.Section>

          <FieldGroup.Section title="Danger zone">
            <Text
              textStyle={{ fontSize: 16, color: '#FF3B30' }}
              onPress={handleReset}
              testID="reset-all-data"
            >
              Reset all data
            </Text>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>

      {restoring && (
        <View style={styles.restoreOverlay}>
          <ActivityIndicator size="large" />
          <RNText style={styles.restoreText}>Restoring database</RNText>
        </View>
      )}
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
});
