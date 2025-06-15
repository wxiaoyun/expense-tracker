import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { openURL } from "expo-linking";
import React from "react";
import { ScrollView, StyleSheet, Switch, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemTitle,
  DropdownMenuLabel,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/DropdownMenu";
import { SettingGroup, SimpleSettingItem } from "@/components/setting";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import {
  BUY_ME_A_COFFEE_URL,
  GITHUB_ISSUE_URL,
  GITHUB_URL,
  WEEK_START_OPTIONS,
} from "@/constants";
import {
  useBackupInterval,
  useCurrency,
  useEnableClipboardCommand,
  useWeekStart,
} from "@/hooks/useKv";
import { useThemeColor } from "@/hooks/useThemeColor";
import { showAlert, showConfirmDialog } from "@/libs/dialog";
import {
  exportCsvFromDb,
  exportDatabase,
  importCsv,
  importDatabase,
  purgeDatabase,
} from "@/libs/fs";
import { toast } from "sonner-native";

const DataGroup = () => {
  const iconColor = useThemeColor("icon");
  const destructiveColor = useThemeColor("destructive");
  const [interval] = useBackupInterval();

  const handleExportDatabase = async () => {
    await exportDatabase(
      toast.success,
      (errMsg) => showAlert("Error", errMsg, { kind: "error" }),
    );
  };

  const handleImportDatabase = async () => {
    const confirmed = await showConfirmDialog(
      "Import Database",
      "This will replace your current database with the imported one. Make sure you have a backup before proceeding. Continue?",
      {
        okLabel: "Import",
        cancelLabel: "Cancel",
        kind: "warning",
      },
    );

    if (confirmed) {
      await importDatabase(
        toast.success,
        (errMsg) => showAlert("Error", errMsg, { kind: "error" }),
      );
    }
  };

  const handleExportCsv = async () => {
    await exportCsvFromDb(
      toast.success,
      (errMsg) => showAlert("Error", errMsg, { kind: "error" }),
    );
  };

  const handleImportCsv = async () => {
    const confirmed = await showConfirmDialog(
      "Import CSV",
      "This will add new transactions from the CSV file to your database. Continue?",
      {
        okLabel: "Import",
        cancelLabel: "Cancel",
        kind: "info",
      },
    );

    if (confirmed) {
      await importCsv(
        false, // overwrite = false (append mode)
        toast.success,
        (errMsg) => showAlert("Error", errMsg, { kind: "error" }),
      );
    }
  };

  const handleAppendCsv = async () => {
    const confirmed = await showConfirmDialog(
      "Append CSV",
      "This will add new transactions from the CSV file to your existing data. Continue?",
      {
        okLabel: "Append",
        cancelLabel: "Cancel",
        kind: "info",
      },
    );

    if (confirmed) {
      await importCsv(
        false, // overwrite = false (append mode)
        toast.success,
        (errMsg) => showAlert("Error", errMsg, { kind: "error" }),
      );
    }
  };

  const handleClearDatabase = async () => {
    const confirmed = await showConfirmDialog(
      "Clear Database",
      "Are you sure you want to clear all transactions? This action cannot be undone.",
      {
        okLabel: "Clear",
        cancelLabel: "Cancel",
        kind: "error",
      },
    );

    if (confirmed) {
      try {
        await purgeDatabase();
        toast.success("Database cleared successfully, restart the app to see the changes");
      } catch (error) {
        console.error("Failed to clear database:", error);
        await showAlert("Error", "Failed to clear database", { kind: "error" });
      }
    }
  };

  return (
    <SettingGroup title="Data">
      <ThemedView style={styles.groupContainer}>
        <SimpleSettingItem
          icon={<FontAwesome name="upload" size={24} color={iconColor} />}
          title="Export database"
          onPress={handleExportDatabase}
        />
        <SimpleSettingItem
          icon={<FontAwesome name="download" size={24} color={iconColor} />}
          title="Import database"
          onPress={handleImportDatabase}
        />
        <SimpleSettingItem
          icon={<FontAwesome6 name="file-csv" size={24} color={iconColor} />}
          title="Export CSV"
          onPress={handleExportCsv}
        />
        <SimpleSettingItem
          icon={<FontAwesome6 name="file-csv" size={24} color={iconColor} />}
          title="Import CSV"
          onPress={handleImportCsv}
        />
        <SimpleSettingItem
          icon={<FontAwesome6 name="file-csv" size={24} color={iconColor} />}
          title="Append CSV"
          onPress={handleAppendCsv}
        />
        <SimpleSettingItem
          icon={
            <MaterialIcons name="event-repeat" size={24} color={iconColor} />
          }
          title="Periodic backup"
          href="/backup"
          chevronSibling={interval}
        />
        <SimpleSettingItem
          icon={
            <FontAwesome5 name="trash" size={24} color={destructiveColor} />
          }
          title="Clear database"
          onPress={handleClearDatabase}
        />
      </ThemedView>
    </SettingGroup>
  );
};

const WeekStartSettingItem = () => {
  const iconColor = useThemeColor("icon");
  const [weekStart, setWeekStart] = useWeekStart();
  return (
    <SimpleSettingItem
      icon={<FontAwesome5 name="calendar-week" size={24} color={iconColor} />}
      title="Week start"
      chevronSibling={
        <DropdownMenuRoot>
          <DropdownMenuTrigger>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <ThemedText>{weekStart}</ThemedText>
            </TouchableOpacity>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right">
            {WEEK_START_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option}
                onSelect={() => setWeekStart(option)}
              >
                <DropdownMenuItemTitle>{option}</DropdownMenuItemTitle>
              </DropdownMenuItem>
            ))}
            <DropdownMenuLabel />
            <DropdownMenuSeparator />
            <DropdownMenuArrow />
          </DropdownMenuContent>
        </DropdownMenuRoot>
      }
    />
  );
};

const ConfigGroup = () => {
  const iconColor = useThemeColor("icon");
  const [currency] = useCurrency();
  const [isCmdEnabled, setIsCmdEnabled] = useEnableClipboardCommand();

  return (
    <SettingGroup title="Configuration">
      <ThemedView style={styles.groupContainer}>
        <SimpleSettingItem
          icon={<FontAwesome6 name="coins" size={24} color={iconColor} />}
          title="Currency"
          href="/currency"
          chevronSibling={currency}
        />
        <WeekStartSettingItem />
        <SimpleSettingItem
          icon={<Ionicons name="clipboard" size={24} color={iconColor} />}
          title="Clipboard commands"
          chevronSibling={
            <Switch value={isCmdEnabled} onValueChange={setIsCmdEnabled} />
          }
        />
      </ThemedView>
    </SettingGroup>
  );
};

const MiscGroup = () => {
  const iconColor = useThemeColor("icon");
  return (
    <SettingGroup title="Miscellaneous">
      <ThemedView style={styles.groupContainer}>
        <SimpleSettingItem
          icon={<Ionicons name="bug" size={24} color={iconColor} />}
          title="Bug report"
          chevronSibling={
            <Feather name="arrow-up-right" size={16} color={iconColor} />
          }
          onPress={() => openURL(GITHUB_ISSUE_URL)}
        />

        <SimpleSettingItem
          icon={<Ionicons name="logo-github" size={24} color={iconColor} />}
          title="Star on GitHub"
          chevronSibling={
            <Feather name="arrow-up-right" size={16} color={iconColor} />
          }
          onPress={() => openURL(GITHUB_URL)}
        />

        <SimpleSettingItem
          icon={<FontAwesome name="coffee" size={24} color={iconColor} />}
          title="Buy me a coffee"
          chevronSibling={
            <Feather name="arrow-up-right" size={16} color={iconColor} />
          }
          onPress={() => openURL(BUY_ME_A_COFFEE_URL)}
        />
      </ThemedView>
    </SettingGroup>
  );
};

export default function SettingScreen() {
  const bottomTabBarHeight = useBottomTabBarHeight();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <SafeAreaView
        style={[styles.container, { paddingBottom: bottomTabBarHeight }]}
        edges={["left", "right"]}
      >
        <DataGroup />
        <ConfigGroup />
        <MiscGroup />
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    borderRadius: 8,
    padding: 16,
    gap: 16,
  },
  groupContainer: {
    flexDirection: "column",
  },
});
