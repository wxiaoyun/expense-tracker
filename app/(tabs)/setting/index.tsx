import FontAwesome from "@expo/vector-icons/FontAwesome";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { openURL } from "expo-linking";
import {
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  SafeAreaView
} from "react-native-safe-area-context";

import { BottomSheets, BottomSheetsRef } from "@/components/BottomSheet";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";

type SettingGroupProps = {
  title: string;
  children: React.ReactNode;
};

const SettingGroup = ({ title, children }: SettingGroupProps) => {
  return (
    <ThemedView style={styles.innerContainer}>
      <ThemedText type="defaultSemiBold">{title}</ThemedText>
      {children}
    </ThemedView>
  );
};

type SimpleSettingItemProps = {
  icon: React.ReactNode;
  title: string;
  onPress?: () => void;
};

const SimpleSettingItem: React.FC<SimpleSettingItemProps> = (props) => {
  const { icon: Icon, title, onPress } = props;
  const iconColor = useThemeColor({}, "icon");

  return (
    <TouchableOpacity onPress={onPress}>
      <ThemedView style={styles.settingRow}>
        {Icon}
        <ThemedView style={styles.settingItem}>
          <ThemedText type="default">{title}</ThemedText>
          <Ionicons name="chevron-forward" size={16} color={iconColor} />
        </ThemedView>
      </ThemedView>
    </TouchableOpacity>
  );
};

const DataGroup = () => {
  const router = useRouter();
  const iconColor = useThemeColor({}, "icon");

  return (
    <SettingGroup title="Data">
      <ThemedView style={styles.groupContainer}>
        <SimpleSettingItem
          icon={<Ionicons name="download" size={30} color={iconColor} />}
          title="Local backup"
          onPress={() => router.push("/setting/test")}
        />
      </ThemedView>
    </SettingGroup>
  );
};

const ConfigGroup = () => {
  const router = useRouter();
  const iconColor = useThemeColor({}, "icon");
  const bottomSheetsRef = useRef<BottomSheetsRef>(null);

  return (
    <SettingGroup title="Configuration">
      <ThemedView style={styles.groupContainer}>
        <SimpleSettingItem
          icon={<Ionicons name="color-palette" size={30} color={iconColor} />}
          title="Theme"
          onPress={() => bottomSheetsRef.current?.openThemeSheet()}
        />
      </ThemedView>
    </SettingGroup>
  );
};

const MiscGroup = () => {
  const iconColor = useThemeColor({}, "icon");
  return (
    <SettingGroup title="Miscellaneous">
      <ThemedView style={styles.groupContainer}>
        <SimpleSettingItem
          icon={<Ionicons name="bug" size={30} color={iconColor} />}
          title="Bug report"
          onPress={() =>
            openURL("https://github.com/wxiaoyun/expense-tracker/issues")
          }
        />

        <SimpleSettingItem
          icon={<Ionicons name="logo-github" size={30} color={iconColor} />}
          title="Star on GitHub"
          onPress={() => openURL("https://github.com/wxiaoyun/expense-tracker")}
        />

        <SimpleSettingItem
          icon={<FontAwesome name="coffee" size={30} color={iconColor} />}
          title="Buy me a coffee"
          onPress={() => openURL("https://buymeacoffee.com/wxiaoyun")}
        />
      </ThemedView>
    </SettingGroup>
  );
};

export default function SettingScreen() {
  const textColor = useThemeColor({}, "tint");
  const bottomSheetsRef = useRef<BottomSheetsRef>(null);

  const [enablePeriodicBackup, setEnablePeriodicBackup] = useState(false);
  const intervalOptions = [
    { label: "1 hour", value: "1" },
    { label: "2 hours", value: "2" },
    { label: "3 hours", value: "3" },
  ];
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentInsetAdjustmentBehavior="automatic">
          <ThemedView style={styles.innerContainer}>
            <ThemedText type="subtitle">Data</ThemedText>

            <ThemedView
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <ThemedText type="defaultSemiBold">Export database</ThemedText>
              <Button title="Export" onPress={() => {}} />
            </ThemedView>

            <ThemedView
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <ThemedText type="defaultSemiBold">Import database</ThemedText>
              <Button title="Import" onPress={() => {}} />
            </ThemedView>

            <ThemedView
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Pressable onPress={() => {}}>
                <ThemedView
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <MaterialIcons name="delete" size={30} color={"red"} />
                  <ThemedText type="defaultSemiBold" style={{ color: "red" }}>
                    Clear database
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>

            <ThemedView
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <ThemedView
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <MaterialIcons name="backup" size={30} color={textColor} />
                <ThemedText type="defaultSemiBold">Periodic backup</ThemedText>
              </ThemedView>
              <Switch
                value={enablePeriodicBackup}
                onValueChange={() =>
                  setEnablePeriodicBackup(!enablePeriodicBackup)
                }
              />
            </ThemedView>

            {enablePeriodicBackup && (
              <ThemedView
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <ThemedText type="defaultSemiBold">
                  {intervalOptions[selectedIndex].label}
                </ThemedText>
                <Button 
                  title="Change" 
                  onPress={() => bottomSheetsRef.current?.openIntervalSheet()} 
                />
              </ThemedView>
            )}
          </ThemedView>

          <DataGroup />
          <ConfigGroup />
          <MiscGroup />
        </ScrollView>

        <BottomSheets
          ref={bottomSheetsRef}
          intervalOptions={intervalOptions}
          selectedIntervalIndex={selectedIndex}
          onIntervalChange={setSelectedIndex}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  innerContainer: {
    marginTop: 16,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 4,
  },
  groupContainer: {
    flexDirection: "column",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingItem: {
    flex: 1,
    paddingVertical: 6,
    height: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
