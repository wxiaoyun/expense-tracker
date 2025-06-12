import { useQuery, useQueryClient } from "@tanstack/react-query";
import Storage from "expo-sqlite/kv-store";
import { useCallback, useMemo } from "react";
import { useColorScheme } from "react-native";

export const useKy = (key: string, defaultValue?: string) => {
  const defaultData = defaultValue ?? "";
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["kv", key, defaultData],
    queryFn: async () => {
      const value = await Storage.getItem(key);
      return value ?? defaultData;
    },
    placeholderData: defaultData,
  });

  const setValue = useCallback(
    async (value: string) => {
      await Storage.setItem(key, value);
      queryClient.setQueryData(["kv", key, defaultData], value);
    },
    [queryClient, key, defaultData],
  );

  return [data ?? defaultData, setValue] as const;
};

export const useCurrency = () => {
  return useKy("currency", "SGD");
};

export const useTheme = () => {
  return useKy("theme", "system");
};

export const useResolvedTheme = () => {
  const theme = useColorScheme() ?? "light";
  return useKy("theme", theme);
};

export const useWeekStart = () => {
  return useKy("weekStart", "monday");
};

export const useBackupInterval = () => {
  return useKy("backupInterval", "monthly");
};

export const useLastBackup = () => {
  const [lastBackup, setLastBackup] = useKy("lastBackup", "0");

  const lastBackupUnix = useMemo(() => {
    return Number(lastBackup) || 0;
  }, [lastBackup]);

  const setLastBackupUnix = useCallback(
    (unix: number) => {
      setLastBackup(unix.toString());
    },
    [setLastBackup],
  );

  return [lastBackupUnix, setLastBackupUnix] as const;
};

export const useEnableClipboardCommand = () => {
  const [enableClipboardCommand, setEnableClipboardCommand] = useKy(
    "enableClipboardCommand",
    "false",
  );

  const enabled = useMemo(() => {
    return enableClipboardCommand === "true";
  }, [enableClipboardCommand]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      setEnableClipboardCommand(enabled ? "true" : "false");
    },
    [setEnableClipboardCommand],
  );

  return [enabled, setEnabled] as const;
};
