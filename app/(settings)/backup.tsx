import { MaterialIcons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import { SettingGroup, SimpleSettingItem } from "@/components/setting";
import { ThemedText } from "@/components/ThemedText";
import {
  BACKUP_DIR,
  BACKUP_INTERVAL_OPTIONS,
  BackupInterval,
} from "@/constants";
import { useBackupInterval, useLastBackup } from "@/hooks/useKv";
import { useThemeColor } from "@/hooks/useThemeColor";
import { backupDatabase, deleteBackup, listBackups } from "@/libs/fs";

type SwipeableBackupProps = {
  filename: string;
  onDelete: (filename: string, onTriggered?: () => void) => void;
  onShare: (filename: string, onTriggered?: () => void) => void;
};

const SwipeableBackup = ({
  filename,
  onDelete,
  onShare,
}: SwipeableBackupProps) => {
  const textColor = useThemeColor("text");
  const borderColor = useThemeColor("text") + "20";
  const backgroundColor = useThemeColor("background");
  const destructiveColor = useThemeColor("destructive");

  const translateX = useSharedValue(0);

  const handleDeleteAction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDelete(filename, () => {
      translateX.value = withSpring(0, {
        damping: 30,
        stiffness: 300,
      });
    });
  }, [onDelete, filename, translateX]);

  const handleShareAction = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onShare(filename, () => {
      translateX.value = withSpring(0, {
        damping: 30,
        stiffness: 300,
      });
    });
  }, [onShare, filename, translateX]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .minDistance(10)
    .onUpdate((event) => {
      "worklet";
      const maxSwipe = 120;
      // Allow both left and right swipe
      translateX.value = Math.max(
        -maxSwipe,
        Math.min(maxSwipe, event.translationX),
      );
    })
    .onEnd((event) => {
      "worklet";
      const shouldReveal = Math.abs(event.translationX) > 60;

      if (shouldReveal) {
        if (event.translationX > 0) {
          // Swipe right - Share
          translateX.value = withSpring(120, {
            damping: 30,
            stiffness: 300,
          });
          runOnJS(handleShareAction)();
        } else {
          // Swipe left - Delete
          translateX.value = withSpring(-120, {
            damping: 30,
            stiffness: 300,
          });
          runOnJS(handleDeleteAction)();
        }
      } else {
        translateX.value = withSpring(0, {
          damping: 30,
          stiffness: 300,
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      transform: [{ translateX: translateX.value }],
    };
  }, []);

  const leftActionStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: translateX.value > 0 ? 1 : 0,
    };
  }, []);

  const rightActionStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: translateX.value < 0 ? 1 : 0,
    };
  }, []);

  // Format the filename to show date
  const formattedDate = useMemo(() => {
    try {
      const isoString = filename.replace(".db", "");
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return filename;
    }
  }, [filename]);

  return (
    <View style={styles.swipeContainer}>
      <Animated.View style={[styles.leftAction, leftActionStyle]}>
        <Feather name="share" size={20} color="white" />
      </Animated.View>

      <Animated.View
        style={[
          styles.rightAction,
          rightActionStyle,
          { backgroundColor: destructiveColor },
        ]}
      >
        <Feather name="trash-2" size={20} color="white" />
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.backupItem,
            { backgroundColor, borderBottomColor: borderColor },
            animatedStyle,
          ]}
        >
          <View style={styles.backupContent}>
            <Feather
              name="database"
              size={20}
              color={textColor}
              style={styles.backupIcon}
            />
            <View style={styles.backupTextContainer}>
              <ThemedText>{formattedDate}</ThemedText>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default function Page() {
  const iconColor = useThemeColor("icon");
  const textColor = useThemeColor("text");
  const [interval, setInterval] = useBackupInterval();
  const [lastBackup] = useLastBackup();

  const [backups, setBackups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
    },
    [setInterval],
  );

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listBackups();
      if (result.ok) {
        setBackups(result.data || []);
      } else {
        console.error("Failed to load backups:", result.err);
        setBackups([]);
      }
    } catch (error) {
      console.error("Error loading backups:", error);
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteBackup = useCallback(
    (filename: string, onTriggered?: () => void) => {
      Alert.alert(
        "Delete Backup",
        `Are you sure you want to delete this backup?\n\n${filename}`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: onTriggered,
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteBackup(
                  filename,
                  (msg) => {
                    toast.success(msg);
                    loadBackups(); // Refresh the list
                  },
                  (errMsg) => {
                    toast.error(errMsg);
                  },
                );
              } catch (error) {
                console.error("Error deleting backup:", error);
              } finally {
                onTriggered?.();
              }
            },
          },
        ],
      );
    },
    [loadBackups],
  );

  const handleShareBackup = useCallback(
    async (filename: string, onTriggered?: () => void) => {
      try {
        const backupPath = `${FileSystem.documentDirectory}${BACKUP_DIR}/${filename}`;

        // Check if the file exists
        const fileInfo = await FileSystem.getInfoAsync(backupPath);
        if (!fileInfo.exists) {
          toast.error("Backup file not found");
          onTriggered?.();
          return;
        }

        // Share the backup file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(backupPath, {
            mimeType: "application/octet-stream",
            dialogTitle: "Share Backup",
          });
          toast.success("Backup shared successfully");
        } else {
          toast.error("Sharing is not available on this device");
        }
      } catch (error) {
        console.error("Error sharing backup:", error);
        toast.error("Failed to share backup");
      } finally {
        onTriggered?.();
      }
    },
    [],
  );

  const handleCreateBackup = useCallback(async () => {
    setRefreshing(true);
    try {
      await backupDatabase(
        (msg) => {
          toast.success(msg);
          loadBackups(); // Refresh the list
        },
        (errMsg) => {
          toast.error(errMsg);
        },
      );
    } catch (error) {
      console.error("Error creating backup:", error);
    } finally {
      setRefreshing(false);
    }
  }, [loadBackups]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  return (
    <SafeAreaView style={styles.flex} edges={["left", "right"]}>
      <Stack.Screen
        options={{
          title: "Periodic Backup",
          headerBackTitle: "Back",
        }}
      />

      <ScrollView style={styles.flex}>
        <View style={styles.container}>
          <SettingGroup>
            <SimpleSettingItem
              icon={
                refreshing ? (
                  <ActivityIndicator size={24} color={iconColor} />
                ) : (
                  <MaterialIcons name="backup" size={24} color={iconColor} />
                )
              }
              title="Create Backup Now"
              onPress={refreshing ? undefined : handleCreateBackup}
            />

            <SimpleSettingItem
              icon={
                <MaterialIcons
                  name="event-repeat"
                  size={24}
                  color={iconColor}
                />
              }
              title="Auto Backup"
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

          {/* Backup Files List */}
          <SettingGroup title="Available Backups">
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={textColor} />
                <ThemedText style={styles.loadingText}>
                  Loading backups...
                </ThemedText>
              </View>
            ) : backups.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="database" size={48} color={textColor + "40"} />
                <ThemedText style={[styles.emptyTitle, { color: textColor }]}>
                  No backups found
                </ThemedText>
                <ThemedText
                  style={[styles.emptySubtitle, { color: textColor + "80" }]}
                >
                  Create your first backup to get started
                </ThemedText>
              </View>
            ) : (
              <View style={styles.backupList}>
                {backups.map((filename) => (
                  <SwipeableBackup
                    key={filename}
                    filename={filename}
                    onDelete={handleDeleteBackup}
                    onShare={handleShareBackup}
                  />
                ))}
              </View>
            )}
          </SettingGroup>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    padding: 16,
  },
  flex: {
    flex: 1,
  },
  subText: {
    paddingHorizontal: 16,
  },
  backupList: {
    borderRadius: 12,
    overflow: "hidden",
  },
  swipeContainer: {
    position: "relative",
  },
  leftAction: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 120,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    backgroundColor: "#007AFF",
  },
  rightAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 120,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  backupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  backupContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  backupIcon: {
    marginRight: 12,
  },
  backupTextContainer: {
    flex: 1,
  },
  backupDate: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  loadingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: "center",
  },
});
