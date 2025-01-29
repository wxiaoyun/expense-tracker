import { settings } from "@/db";
import { createQuery } from "@tanstack/solid-query";

export const SETTINGS_QUERY_KEY = "settings";

export const createSettingQuery = (
  key: () => string,
  defaultValue?: string,
) => {
  return createQuery(() => ({
    queryKey: [SETTINGS_QUERY_KEY, key()],
    queryFn: () => settings.get(key(), defaultValue),
    staleTime: Infinity,
  }));
};
