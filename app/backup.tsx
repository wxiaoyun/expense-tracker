import { MaterialIcons } from "@expo/vector-icons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack } from "expo-router";
import { useCallback, useMemo } from "react";
import { LayoutAnimation, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingGroup, SimpleSettingItem } from "@/components/setting";
import { ThemedText } from "@/components/ThemedText";
import { BACKUP_INTERVAL_OPTIONS, BackupInterval } from "@/constants";
import { useBackupInterval, useLastBackup } from "@/hooks/useKv";
import { useThemeColor } from "@/hooks/useThemeColor";

export default function Page() {
  const iconColor = useThemeColor("icon");
  const [interval, setInterval] = useBackupInterval();
  const [lastBackup] = useLastBackup();
  const lastBackupDate = useMemo(() => {
    if (lastBackup === 0) {
      return "never";
    }
    return new Date(lastBackup * 1000).toLocaleDateString();
  }, [lastBackup]);

  const isEnabled = useMemo(() => interval !== "off", [interval]);
  const setEnable = useCallback(
    (e: boolean) => {
      if (e) {
        setInterval("monthly" satisfies BackupInterval);
        return;
      }
      setInterval("off" satisfies BackupInterval);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    },
    [setInterval],
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <Stack.Screen
        options={{
          title: "Periodic Backup",
          headerBackTitle: "Back",
        }}
      />
      <SettingGroup>
        <SimpleSettingItem
          icon={
            <MaterialIcons name="event-repeat" size={24} color={iconColor} />
          }
          title="Backup"
          chevronSibling={
            <Switch value={isEnabled} onValueChange={setEnable} />
          }
        />

        {isEnabled &&
          BACKUP_INTERVAL_OPTIONS.map((option) => (
            <SimpleSettingItem
              key={option}
              icon={
                option === interval ? (
                  <Ionicons name="checkmark" size={24} color={iconColor} />
                ) : (
                  <View />
                )
              }
              title={option}
              onPress={() => setInterval(option)}
            />
          ))}
      </SettingGroup>

      <ThemedText type="defaultSmall" style={styles.subText}>
        {`Last backed up: ${lastBackupDate}`}
      </ThemedText>
    </SafeAreaView>
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
  subText: {
    paddingHorizontal: 16,
  },
});
