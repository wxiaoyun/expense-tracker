import { MaterialIcons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Reanimated, {
  Easing,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";

import { SettingGroup, SimpleSettingItem } from "@/components/setting";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { BACKUP_INTERVAL_OPTIONS, BackupInterval } from "@/constants";
import { Colors } from "@/constants/Colors";
import { useBackupInterval, useLastBackup } from "@/hooks/useKv";
import { useThemeColor } from "@/hooks/useThemeColor";
import {
  backupDatabase,
  deleteBackup,
  listBackups,
  shareBackup,
} from "@/libs/fs";

type SwipeableBackupProps = {
  filename: string;
  onDelete: (filename: string, animateDelete: () => Promise<unknown>) => void;
  onShare: (filename: string) => void;
};

function LeftAction(prog: SharedValue<number>, drag: SharedValue<number>) {
  const hasReachedThresholdUp = useSharedValue(false);
  const hasReachedThresholdDown = useSharedValue(false);

  useAnimatedReaction(
    () => {
      return drag.value;
    },
    (dragValue) => {
      if (Math.abs(dragValue) > 60 && !hasReachedThresholdUp.value) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        hasReachedThresholdUp.value = true;
        hasReachedThresholdDown.value = false;
      } else if (Math.abs(dragValue) < 60 && !hasReachedThresholdDown.value) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        hasReachedThresholdDown.value = true;
        hasReachedThresholdUp.value = false;
      }
    },
  );

  const animatedStyle = useAnimatedStyle(() => {
    if (Math.abs(drag.value) > 60) {
      return {
        backgroundColor: Colors.light.info,
      };
    }
    return {
      backgroundColor: Colors.dark.info,
    };
  });

  return (
    <Reanimated.View style={[{ flex: 1 }]}>
      <Reanimated.View style={[styles.leftAction, animatedStyle]}>
        <Feather name="share" size={20} color="white" />
      </Reanimated.View>
    </Reanimated.View>
  );
}

function RightAction(prog: SharedValue<number>, drag: SharedValue<number>) {
  const hasReachedThresholdUp = useSharedValue(false);
  const hasReachedThresholdDown = useSharedValue(false);

  useAnimatedReaction(
    () => {
      return drag.value;
    },
    (dragValue) => {
      if (Math.abs(dragValue) > 60 && !hasReachedThresholdUp.value) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        hasReachedThresholdUp.value = true;
        hasReachedThresholdDown.value = false;
      } else if (Math.abs(dragValue) < 60 && !hasReachedThresholdDown.value) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        hasReachedThresholdDown.value = true;
        hasReachedThresholdUp.value = false;
      }
    },
  );

  const animatedStyle = useAnimatedStyle(() => {
    if (Math.abs(drag.value) > 60) {
      return {
        backgroundColor: Colors.dark.destructive,
      };
    }
    return {
      backgroundColor: Colors.light.destructive,
    };
  });

  return (
    <Reanimated.View style={[{ flex: 1 }]}>
      <Reanimated.View style={[styles.rightAction, animatedStyle]}>
        <Feather name="trash-2" size={20} color="white" />
      </Reanimated.View>
    </Reanimated.View>
  );
}

const SwipeableBackup = ({
  filename,
  onDelete,
  onShare,
}: SwipeableBackupProps) => {
  const textColor = useThemeColor("text");
  const borderColor = useThemeColor("text") + "20";
  const backgroundColor = useThemeColor("background");

  const reanimatedRef = useRef<SwipeableMethods>(null);
  const heightAnim = useSharedValue(60);
  const opacityAnim = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: heightAnim.value,
      opacity: opacityAnim.value,
    };
  });

  const animateDelete = useCallback(() => {
    // Animate out before deletion
    return new Promise((resolve) => {
      heightAnim.value = withTiming(0, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
      opacityAnim.value = withTiming(0, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });

      setTimeout(() => {
        resolve(true);
      }, 300);
    });
  }, [heightAnim, opacityAnim]);

  const onSwipeableLeftOpen = () => {
    reanimatedRef.current?.close();
    // Left swipe exposes right action (delete)
    onDelete(filename, animateDelete);
  };

  const onSwipeableRightOpen = () => {
    reanimatedRef.current?.close();
    // Right swipe exposes left action (share)
    onShare(filename);
  };

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
    <Reanimated.View style={animatedStyle}>
      <ReanimatedSwipeable
        ref={reanimatedRef}
        containerStyle={[styles.swipeableContainer, { backgroundColor }]}
        friction={2}
        enableTrackpadTwoFingerGesture
        leftThreshold={40}
        rightThreshold={40}
        renderLeftActions={LeftAction}
        renderRightActions={RightAction}
        onSwipeableWillOpen={(direction) => {
          if (direction === "left") {
            onSwipeableLeftOpen();
          } else {
            onSwipeableRightOpen();
          }
        }}
      >
        <View
          style={[
            styles.backupItem,
            { backgroundColor, borderBottomColor: borderColor },
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
        </View>
      </ReanimatedSwipeable>
    </Reanimated.View>
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
    const result = await listBackups();

    if (result.ok) {
      setBackups(result.data || []);
    } else {
      console.error("Failed to load backups:", result.err);
      setBackups([]);
      toast.error(result.err);
    }

    setLoading(false);
  }, []);

  const handleDeleteBackup = useCallback(
    (filename: string, animateDelete: () => Promise<unknown>) => {
      Alert.alert(
        "Delete Backup",
        `Are you sure you want to delete this backup?\n\n${filename}`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              // Start the delete animation
              await animateDelete();

              // Wait for animation to complete before actually deleting
              const result = await deleteBackup(filename);

              if (result.ok) {
                toast.success(result.data);
                loadBackups(); // Refresh the list
              } else {
                toast.error(result.err);
              }
            },
          },
        ],
      );
    },
    [loadBackups],
  );

  const handleShareBackup = useCallback(async (filename: string) => {
    const result = await shareBackup(filename);

    if (result.ok) {
      toast.success(result.data);
    } else {
      toast.error(result.err);
    }
  }, []);

  const handleCreateBackup = useCallback(async () => {
    setRefreshing(true);

    const result = await backupDatabase();

    if (result.ok) {
      toast.success(result.data);
      loadBackups(); // Refresh the list
    } else {
      toast.error(result.err);
    }

    setRefreshing(false);
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
          <ThemedView style={styles.backupListContainer}>
            <ThemedText type="defaultSemiBold" style={styles.backupListTitle}>
              Available Backups
            </ThemedText>
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
          </ThemedView>
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
    overflow: "hidden",
  },
  swipeableContainer: {
    backgroundColor: "transparent",
  },
  leftAction: {
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    flex: 1,
  },
  rightAction: {
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    flex: 1,
  },
  backupListContainer: {
    borderRadius: 12,
    paddingTop: 4,
    paddingBottom:12,
  },
  backupListTitle: {
    paddingHorizontal: 16,
  },
  backupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
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
