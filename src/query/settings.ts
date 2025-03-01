import { settings } from "@/db";
import { createQuery } from "@tanstack/solid-query";
import { queryClient } from "./query";

export const SETTINGS_QUERY_KEY = "settings";

export const invalidateSettingsQuery = (...keys: unknown[]) => {
  queryClient.invalidateQueries({
    queryKey: [SETTINGS_QUERY_KEY, ...keys],
  });
};

export const createSettingQuery = (
  key: () => string,
  defaultValue?: string,
) => {
  return createQuery(() => ({
    queryKey: [SETTINGS_QUERY_KEY, key()],
    queryFn: () => settings.get(key(), defaultValue),
  }));
};
