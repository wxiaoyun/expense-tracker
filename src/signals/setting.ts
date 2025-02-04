import { DEFAULT_THEME } from "@/constants/settings";
import { settings } from "@/db";
import { createSettingQuery } from "@/query/settings";
import { getSystemTheme } from "@/utils/theme";
import { createMemo } from "solid-js";

export const useSetting = <T = string>(
  key: () => string,
  defaultValue?: string,
  options?: {
    parser: (value: string) => T;
    serializer: (value: T) => string;
  },
) => {
  const query = createSettingQuery(key, defaultValue);

  const res = createMemo(() => {
    if (!options?.parser || !query.data) return query;

    return {
      ...query,
      data: options.parser(query.data),
    };
  });

  const setSetting = (value: T) => {
    settings
      .set(key(), options?.serializer ? options.serializer(value) : value)
      .then(() => {
        query.refetch();
      });
  };

  return [res, setSetting] as [() => typeof query, (value: T) => void];
};

export const useCurrency = () => {
  const [query, setCurrency] = useSetting(
    () => CURRENCY_SETTING_KEY,
    DEFAULT_CURRENCY,
  );

  const currency = createMemo(() => {
    const data = query().data;
    if (!data) return DEFAULT_CURRENCY;
    return data;
  });

  return [currency, setCurrency] as const;
};

export const useTheme = () => {
  const [query, setTheme] = useSetting(() => THEME_SETTING_KEY, DEFAULT_THEME);

  const theme = createMemo(() => {
    const data = query().data;
    if (!data) return DEFAULT_THEME;

    return data as "light" | "dark" | "system";
  });

  return [theme, setTheme] as const;
};

export const useResolvedTheme = () => {
  const [theme] = useTheme();

  const resolvedTheme = createMemo(() => {
    if (theme() === "system") {
      return getSystemTheme();
    }
    return theme() as "light" | "dark";
  });

  return resolvedTheme;
};

export const useWeekStart = () => {
  const [query, setWeekStart] = useSetting(
    () => WEEK_START_SETTING_KEY,
    DEFAULT_WEEK_START,
  );

  const weekStart = createMemo(() => {
    const data = query().data;
    if (!data) return DEFAULT_WEEK_START;
    return data;
  });

  return [weekStart, setWeekStart] as const;
};

export const useBackupInterval = () => {
  const [query, setBackupInterval] = useSetting(
    () => BACKUP_INTERVAL_SETTING_KEY,
    DEFAULT_BACKUP_INTERVAL,
  );

  const backupInterval = createMemo(() => {
    const data = query().data;
    if (!data) return DEFAULT_BACKUP_INTERVAL;
    return data;
  });

  return [backupInterval, setBackupInterval] as [
    () => BackupInterval,
    (value: BackupInterval) => void,
  ];
};

export const useLastBackup = () => {
  const [query, setLastBackup] = useSetting(
    () => LAST_BACKUP_SETTING_KEY,
    "0",
    {
      parser: (value) => Number(value),
      serializer: (value) => String(value),
    },
  );

  const lastBackup = createMemo(() => {
    const data = query().data;
    if (!data) return 0;
    return Number(data);
  });

  return [lastBackup, setLastBackup] as const;
};
