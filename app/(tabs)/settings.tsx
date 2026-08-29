import { db } from '@/db';
import { resetAllData, ResetDataError } from '@/db/reset';
import { settings } from '@/db/schema';
import {
  reinitializeAppRuntime,
  waitForLaunchTemplateProcessing,
} from '@/libs/app-runtime';
import { setAutoBackup as registerAutoBackup } from '@/libs/background';
import { createLocalBackup, importDatabase, validateSqliteFile } from '@/libs/backup';
import {
  currencyAtom,
  PREFERENCE_KEYS,
  savePreferenceAndApply,
  SUGGESTION_LOOKBACK_OPTIONS,
  type SuggestionLookback,
  suggestionLookbackAtom,
  type WeekStart,
  weekStartAtom,
} from '@/libs/preferences';
import {
  FieldGroup,
  Host,
  Icon,
  type IconName,
  Picker,
  Row,
  Spacer,
  Switch,
  Text,
} from '@expo/ui';
import { eq } from 'drizzle-orm';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useAtom } from 'jotai';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Text as RNText, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CURRENCIES = ['USD', 'SGD', 'EUR', 'GBP', 'JPY', 'CNY'];
const WEEK_STARTS: { value: WeekStart; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

type PickerOption = { value: string; label: string };

type SettingsRowProps = {
  icon: IconName;
  iconColor: string;
  label: string;
  children?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  testID?: string;
};

function SettingsRow({
  icon,
  iconColor,
  label,
  children,
  onPress,
  destructive = false,
  testID,
}: SettingsRowProps) {
  return (
    <Row alignment="center" spacing={12} style={styles.settingsRow} onPress={onPress} testID={testID}>
      <Icon
        name={icon}
        size={18}
        color="#FFFFFF"
        style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: iconColor }}
      />
      <Text textStyle={{ fontSize: 16, color: destructive ? '#FF3B30' : '#000000' }}>
        {label}
      </Text>
      <Spacer flexible />
      {children}
    </Row>
  );
}

function PreferenceRow({
  icon,
  iconColor,
  label,
  selectedValue,
  options,
  onSelect,
}: {
  icon: IconName;
  iconColor: string;
  label: string;
  selectedValue: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
}) {
  const testIdSuffix = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <SettingsRow
      icon={icon}
      iconColor={iconColor}
      label={label}
      testID={`preference-${testIdSuffix}`}
    >
      <Picker
        selectedValue={selectedValue}
        onValueChange={onSelect}
        testID={`picker-${testIdSuffix}`}
      >
        {options.map((option) => (
          <Picker.Item key={option.value} label={option.label} value={option.value} />
        ))}
      </Picker>
    </SettingsRow>
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
      <View style={[styles.pageHeader, { paddingTop: insets.top + 8 }]}>
        <RNText style={styles.pageTitle}>Settings</RNText>
      </View>

      <Host style={{ flex: 1 }}>
        <FieldGroup>
          <FieldGroup.Section>
            <PreferenceRow
              icon="dollarsign.circle.fill"
              iconColor="#34C759"
              label="Currency"
              selectedValue={currency}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              onSelect={changeCurrency}
            />
            <PreferenceRow
              icon="calendar"
              iconColor="#FF9500"
              label="Week starts"
              selectedValue={weekStart}
              options={WEEK_STARTS}
              onSelect={changeWeekStart}
            />
            <PreferenceRow
              icon="clock.arrow.circlepath"
              iconColor="#AF52DE"
              label="Template suggestion history"
              selectedValue={suggestionLookback}
              options={[...SUGGESTION_LOOKBACK_OPTIONS]}
              onSelect={changeSuggestionLookback}
            />
          </FieldGroup.Section>

          <FieldGroup.Section>
            <SettingsRow
              icon="arrow.clockwise.circle.fill"
              iconColor="#007AFF"
              label="Auto backup"
              testID="auto-backup-row"
            >
              <Switch testID="auto-backup" value={autoBackup} onValueChange={handleAutoBackup} />
            </SettingsRow>
            <SettingsRow
              icon="externaldrive.fill"
              iconColor="#8E8E93"
              label="Back up now"
              onPress={handleBackupNow}
              testID="backup-now"
            />
            <SettingsRow
              icon="square.and.arrow.up"
              iconColor="#007AFF"
              label="Export database"
              onPress={handleExport}
              testID="export-database"
            />
            <SettingsRow
              icon="square.and.arrow.down"
              iconColor="#007AFF"
              label="Import database"
              onPress={handleImport}
              testID="import-database"
            />
          </FieldGroup.Section>

          <FieldGroup.Section>
            <SettingsRow
              icon="trash.fill"
              iconColor="#FF3B30"
              label="Reset all data"
              destructive
              onPress={handleReset}
              testID="reset-all-data"
            />
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
  pageHeader: {
    paddingHorizontal: 16,
  },
  pageTitle: {
    color: '#111111',
    fontSize: 34,
    fontWeight: '700',
  },
  settingsRow: {
    height: 30,
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
