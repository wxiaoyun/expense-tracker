import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, TouchableOpacity } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Href, useRouter } from "expo-router";
import React, { useCallback } from "react";

type SettingGroupProps = {
  title?: string;
  children: React.ReactNode;
};

export const SettingGroup = ({ title, children }: SettingGroupProps) => {
  return (
    <ThemedView style={styles.innerContainer}>
      {title && <ThemedText type="defaultSemiBold">{title}</ThemedText>}
      {children}
    </ThemedView>
  );
};

type SimpleSettingItemProps = {
  icon: React.ReactNode;
  title: string;
  href?: Href;
  chevronSibling?: React.ReactNode;
  onPress?: () => void;
};

export const SimpleSettingItem: React.FC<SimpleSettingItemProps> = (props) => {
  const { icon: Icon, title, onPress, chevronSibling, href } = props;

  const router = useRouter();
  const iconColor = useThemeColor("icon");

  const handlePress = useCallback(() => {
    if (href) {
      router.push(href);
    }
    onPress?.();
  }, [href, onPress, router]);

  return (
    <TouchableOpacity onPress={handlePress}>
      <ThemedView style={styles.row}>
        <ThemedView style={styles.settingIcon}>{Icon}</ThemedView>
        <ThemedView style={styles.settingItem}>
          <ThemedText type="default">{title}</ThemedText>

          <ThemedView style={[styles.row, { gap: 12 }]}>
            {!chevronSibling ? null : typeof chevronSibling === "string" ? (
              <ThemedText type="defaultSmall">{chevronSibling}</ThemedText>
            ) : (
              chevronSibling
            )}

            {href && (
              <Ionicons name="chevron-forward" size={16} color={iconColor} />
            )}
          </ThemedView>
        </ThemedView>
      </ThemedView>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  innerContainer: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 4,
  },
  settingIcon: {
    width: 36,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
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
