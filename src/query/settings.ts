import { settings } from "@/db";
import { createQuery } from "@tanstack/solid-query";
import { queryClient } from "./query";

export const createSettingQuery = (
  key: () => string,
  defaultValue?: string,
) => {
  return createQuery(
    () => ({
      queryKey: ["setting", key()],
      queryFn: () => settings.get(key(), defaultValue),
    }),
    () => queryClient,
  );
};
