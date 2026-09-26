import { db } from "@/db";
import { resetAllData, ResetDataError } from "@/db/reset";
import { settings } from "@/db/schema";
import {
  appQueryClient,
  reinitializeAppRuntime,
  waitForLaunchTemplateProcessing,
} from "@/libs/app-runtime";
import { setAutoBackup as registerAutoBackup } from "@/libs/background";
import {
  createLocalBackup,
  importDatabase,
  validateSqliteFile,
} from "@/libs/backup";
import { parseDbsCsv } from "@/libs/dbs-csv";
import { importDbsRows } from "@/db/import";
import { File } from "expo-file-system";
import {
  actionFeedback,
  errorFeedback,
  selectionFeedback,
  successFeedback,
} from "@/libs/haptics";
import {
  applyThemePreference,
  currencyAtom,
  isThemePreference,
  PREFERENCE_KEYS,
  savePreferenceAndApply,
  SUGGESTION_LOOKBACK_OPTIONS,
  type SuggestionLookback,
  suggestionLookbackAtom,
  themeAtom,
  type ThemePreference,
  type WeekStart,
  weekStartAtom,
} from "@/libs/preferences";
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
} from "@expo/ui";
import { eq } from "drizzle-orm";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useAtom } from "jotai";
import { type ReactNode, useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text as RNText,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/hooks/useThemeColor";
import { queryKeys } from "@/hooks/useTransactionsQuery";

const CURRENCIES = ["USD", "SGD", "EUR", "GBP", "JPY", "CNY"];
const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const WEEK_STARTS: { value: WeekStart; label: string }[] = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
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
  const colors = useThemeColors();
  return (
    <Row
      alignment="center"
      spacing={12}
      style={styles.settingsRow}
      onPress={onPress}
      testID={testID}
    >
      <Icon
        name={icon}
        size={18}
        color={colors.onPrimary}
        style={{
          width: 28,
          height: 28,
          borderRadius: 7,
          backgroundColor: iconColor,
        }}
      />
      <Text
        textStyle={{
          fontSize: 16,
          color: destructive ? colors.destructive : colors.text,
        }}
      >
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
  const testIdSuffix = label.toLowerCase().replace(/\s+/g, "-");
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
          <Picker.Item
            key={option.value}
            label={option.label}
            value={option.value}
          />
        ))}
      </Picker>
    </SettingsRow>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [currency, setCurrency] = useAtom(currencyAtom);
  const [theme, setTheme] = useAtom(themeAtom);
  const [weekStart, setWeekStart] = useAtom(weekStartAtom);
  const [suggestionLookback, setSuggestionLookback] = useAtom(
    suggestionLookbackAtom,
  );
  const [restoring, setRestoring] = useState(false);
  const [autoBackup, setAutoBackup] = useState(() => {
    try {
      console.info("[backup.settings][stage=load] loading backup cadence");
      const row = db
        .select()
        .from(settings)
        .where(eq(settings.key, "backup.cadence"))
        .get();
      return row?.value === "daily";
    } catch (error) {
      console.error("[backup.settings][stage=load] preference load failed", {
        error: String(error),
      });
      return false;
    }
  });

  const handleAutoBackup = async (enabled: boolean) => {
    try {
      console.info("[backup.settings][stage=save] saving backup cadence", {
        enabled,
      });
      await registerAutoBackup(enabled ? "daily" : null);
      await db
        .insert(settings)
        .values({ key: "backup.cadence", value: enabled ? "daily" : "off" })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: enabled ? "daily" : "off" },
        })
        .run();
      setAutoBackup(enabled);
      selectionFeedback();
    } catch (error) {
      console.error("[backup.settings][stage=save] preference save failed", {
        enabled,
        error: String(error),
      });
      errorFeedback();
      Alert.alert("Auto backup failed", String(error));
    }
  };

  const handleBackupNow = async () => {
    actionFeedback();
    try {
      await createLocalBackup();
      console.info("[backup.settings][stage=create_now] backup created");
      successFeedback();
      Alert.alert("Backup created");
    } catch (error) {
      console.error("[backup.settings][stage=create_now] backup failed", {
        error: String(error),
      });
      errorFeedback();
      Alert.alert("Backup failed", String(error));
    }
  };

  const persistPreference = useCallback(
    async (key: string, value: string, onSaved: () => void) => {
      try {
        await savePreferenceAndApply(key, value, onSaved);
      } catch (error) {
        console.error(
          "[settings.preference][stage=save] preference update failed",
          {
            key,
            error: String(error),
          },
        );
        errorFeedback();
        Alert.alert("Preference Not Saved", "Your previous setting was kept.");
      }
    },
    [],
  );

  const changeCurrency = useCallback(
    (value: string) => {
      if (value === currency) return;
      void persistPreference(PREFERENCE_KEYS.currency, value, () => {
        setCurrency(value);
        selectionFeedback();
      });
    },
    [currency, persistPreference, setCurrency],
  );

  const changeTheme = useCallback(
    (value: string) => {
      if (!isThemePreference(value)) return;
      const next: ThemePreference = value;
      if (next === theme) return;
      void persistPreference(PREFERENCE_KEYS.theme, next, () => {
        setTheme(next);
        applyThemePreference(next);
        selectionFeedback();
      });
    },
    [persistPreference, setTheme, theme],
  );

  const changeWeekStart = useCallback(
    (value: string) => {
      const next = value as WeekStart;
      if (next === weekStart) return;
      void persistPreference(PREFERENCE_KEYS.weekStart, next, () => {
        setWeekStart(next);
        selectionFeedback();
      });
    },
    [persistPreference, setWeekStart, weekStart],
  );

  const changeSuggestionLookback = useCallback(
    (value: string) => {
      const next = value as SuggestionLookback;
      if (next === suggestionLookback) return;
      void persistPreference(PREFERENCE_KEYS.suggestionLookback, next, () => {
        setSuggestionLookback(next);
        selectionFeedback();
      });
    },
    [persistPreference, setSuggestionLookback, suggestionLookback],
  );

  const handleExport = async () => {
    actionFeedback();
    try {
      console.info(
        "[backup.export][stage=create_snapshot] creating consistent database snapshot",
      );
      const backupPath = await createLocalBackup();
      console.info(
        "[backup.export][stage=share_db] opening database share sheet",
      );
      await Sharing.shareAsync(backupPath, {
        UTI: "public.database",
        mimeType: "application/x-sqlite3",
      });
      console.info("[backup.export][stage=share_db] database shared");
      successFeedback();
    } catch (err) {
      console.error("[backup.export][stage=share_db] export failed", {
        error: String(err),
      });
      errorFeedback();
      Alert.alert("Export failed", String(err));
    }
  };

  const handleImport = async () => {
    try {
      console.info("[backup.import][stage=pick_db] opening document picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        console.info(
          "[backup.import][stage=pick_db][reason=user_cancelled] import skipped",
        );
        return;
      }

      await validateSqliteFile(result.assets[0].uri);

      Alert.alert(
        "Import database",
        "This will replace your current data. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace",
            style: "destructive",
            onPress: async () => {
              actionFeedback();
              setRestoring(true);
              try {
                const sourceUri = result.assets[0].uri;
                await waitForLaunchTemplateProcessing();
                const recoveryPath = await createLocalBackup();
                console.info(
                  "[backup.import][stage=create_recovery] pre-restore snapshot created",
                  { recovery_path: recoveryPath },
                );
                const importResult = await importDatabase(sourceUri);
                console.info(
                  "[backup.import][stage=sqlite_backup] database imported",
                  {
                    mode: importResult.mode,
                  },
                );
                await reinitializeAppRuntime({
                  processImportedSchedules: true,
                });
                successFeedback();
                router.replace("/(tabs)");
                Alert.alert(
                  "Import complete",
                  importResult.mode === "migrate"
                    ? "Legacy database migrated and app data reloaded."
                    : "Database restored and app data reloaded.",
                );
              } catch (e) {
                console.error("[backup.import][stage=copy_db] import failed", {
                  error: String(e),
                });
                errorFeedback();
                Alert.alert("Import failed", String(e));
              } finally {
                setRestoring(false);
              }
            },
          },
        ],
      );
    } catch (err) {
      console.error("[backup.import][stage=pick_db] import failed", {
        error: String(err),
      });
      Alert.alert("Import failed", String(err));
    }
  };

  const handleImportDbs = async () => {
    try {
      console.info("[import.dbs][stage=pick_csv] opening document picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const text = await new File(result.assets[0].uri).text();
      const parsed = parseDbsCsv(text);
      let outcome;
      try {
        outcome = await importDbsRows(parsed.rows);
      } finally {
        await Promise.all([
          appQueryClient.invalidateQueries({
            queryKey: queryKeys.transactions.all(),
          }),
          appQueryClient.invalidateQueries({
            queryKey: queryKeys.templates.allSuggestions(),
          }),
          appQueryClient.invalidateQueries({
            queryKey: queryKeys.categories.all(),
          }),
        ]);
      }
      successFeedback();
      Alert.alert(
        "Import complete",
        `${outcome.imported} imported, ${outcome.skipped} already present, ${parsed.unreadable} rows unreadable.`,
      );
    } catch (err) {
      console.error("[import.dbs][stage=import_csv] import failed", {
        error: String(err),
      });
      errorFeedback();
      Alert.alert("Import failed", String(err));
    }
  };

  const handleReset = () => {
    Alert.alert(
      "Reset all data",
      "This will delete ALL transactions, templates, and categories. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            actionFeedback();
            try {
              await waitForLaunchTemplateProcessing();
              await resetAllData();
              await reinitializeAppRuntime();
              successFeedback();
              router.replace("/migrate");
            } catch (error) {
              const stage =
                error instanceof ResetDataError ? error.stage : "unknown";
              console.error("[settings.reset] reset failed", {
                stage,
                error: String(error),
              });
              errorFeedback();
              Alert.alert("Reset failed", String(error));
            }
          },
        },
      ],
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: colors.groupedBackground }]}
    >
      <View style={[styles.pageHeader, { paddingTop: insets.top + 8 }]}>
        <RNText style={[styles.pageTitle, { color: colors.text }]}>
          Settings
        </RNText>
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
              icon="circle.lefthalf.filled"
              iconColor="#5856D6"
              label="Appearance"
              selectedValue={theme}
              options={THEMES}
              onSelect={changeTheme}
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
              <Switch
                testID="auto-backup"
                value={autoBackup}
                onValueChange={handleAutoBackup}
              />
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
            <SettingsRow
              icon="doc.text.fill"
              iconColor="#34C759"
              label="Import DBS statement (CSV)"
              onPress={handleImportDbs}
              testID="import-dbs-csv"
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
        <View
          style={[styles.restoreOverlay, { backgroundColor: colors.overlay }]}
        >
          <ActivityIndicator color={colors.primary} size="large" />
          <RNText style={[styles.restoreText, { color: colors.text }]}>
            Restoring database
          </RNText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageHeader: {
    paddingHorizontal: 16,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: "700",
  },
  settingsRow: {
    height: 30,
  },
  restoreOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  restoreText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
  },
});
