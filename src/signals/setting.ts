import { DEFAULT_THEME } from "@/constants/settings";
import { settings } from "@/db";
import { createSettingQuery } from "@/query/settings";
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
  return useSetting(() => CURRENCY_SETTING_KEY, DEFAULT_CURRENCY);
};

export const useTheme = () => {
  return useSetting(() => THEME_SETTING_KEY, DEFAULT_THEME);
};
