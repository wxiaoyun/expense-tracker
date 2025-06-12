import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import Ionicons from "@expo/vector-icons/Ionicons";
import { openURL } from "expo-linking";
import { ScrollView, StyleSheet, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingGroup, SimpleSettingItem } from "@/components/setting";
import { ThemedView } from "@/components/ThemedView";
import { BUY_ME_A_COFFEE_URL, GITHUB_ISSUE_URL, GITHUB_URL } from "@/constants";
import { useCurrency, useEnableClipboardCommand, useTheme, useWeekStart } from "@/hooks/useKv";
import { useThemeColor } from "@/hooks/useThemeColor";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";

const DataGroup = () => {
  const iconColor = useThemeColor("icon");
  const destructiveColor = useThemeColor("destructive");
  const isBackupPeriodicEnabled = false;

  return (
    <SettingGroup title="Data">
      <ThemedView style={styles.groupContainer}>
        <SimpleSettingItem
          icon={<FontAwesome name="download" size={24} color={iconColor} />}
          title="Local backup"
        />
        <SimpleSettingItem
          icon={<FontAwesome name="upload" size={24} color={iconColor} />}
          title="Import database"
        />
        <SimpleSettingItem
          icon={<FontAwesome6 name="file-csv" size={24} color={iconColor} />}
          title="Export CSV"
        />
        <SimpleSettingItem
          icon={<FontAwesome6 name="file-csv" size={24} color={iconColor} />}
          title="Import CSV"
        />
        <SimpleSettingItem
          icon={<FontAwesome6 name="file-csv" size={24} color={iconColor} />}
          title="Append CSV"
        />
        <SimpleSettingItem
          icon={
            <MaterialIcons name="event-repeat" size={24} color={iconColor} />
          }
          title="Periodic backup"
          href="/backup"
          chevronSibling={isBackupPeriodicEnabled ? "Enabled" : "Disabled"}
        />
        <SimpleSettingItem
          icon={
            <FontAwesome5 name="trash" size={24} color={destructiveColor} />
          }
          title="Clear database"
        />
      </ThemedView>
    </SettingGroup>
  );
};

const ConfigGroup = () => {
  const iconColor = useThemeColor("icon");
  const [theme] = useTheme();
  const [currency] = useCurrency();
  const [weekStart] = useWeekStart();
  const [isCmdEnabled, setIsCmdEnabled] = useEnableClipboardCommand();

  return (
    <SettingGroup title="Configuration">
      <ThemedView style={styles.groupContainer}>
        <SimpleSettingItem
          icon={<Ionicons name="color-palette" size={24} color={iconColor} />}
          title="Theme"
          href="/theme"
          chevronSibling={theme}
        />
        <SimpleSettingItem
          icon={<FontAwesome6 name="coins" size={24} color={iconColor} />}
          title="Currency"
          href="/currency"
          chevronSibling={currency}
        />
        <SimpleSettingItem
          icon={
            <FontAwesome5 name="calendar-week" size={24} color={iconColor} />
          }
          title="Week start"
          href="/week_start"
          chevronSibling={weekStart}
        />
        <SimpleSettingItem
          icon={<Ionicons name="clipboard" size={24} color={iconColor} />}
          title="Clipboard commands"
          chevronSibling={
            <Switch
              value={isCmdEnabled}
              onValueChange={setIsCmdEnabled}
            />
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
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.scrollContent}
    >
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        <DataGroup />
        <ConfigGroup />
        <MiscGroup />
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flex: 1,
  },
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
