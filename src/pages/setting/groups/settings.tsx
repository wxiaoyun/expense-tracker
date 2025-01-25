import { ConfirmButton } from "@/components/confirmButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  DEFAULT_THEME,
  THEME_OPTIONS,
} from "@/constants/settings";
import { settings } from "@/db";
import { queryClient } from "@/query";
import { SETTINGS_QUERY_KEY } from "@/query/settings";
import { useCurrency, useTheme } from "@/signals/setting";
import { getSystemTheme, onSystemThemeChange } from "@/utils/theme";
import { ConfigColorMode, useColorMode } from "@kobalte/core";
import { FaSolidTrash } from "solid-icons/fa";
import { createEffect, onCleanup, onMount } from "solid-js";
import { Group } from "../components/group";

export const SettingsGroup = () => {
  return (
    <Group title="Settings">
      <div class="flex flex-col gap-4">
        <CurrencySetting />
        <ThemeSetting />
        <ClearSettings />
      </div>
    </Group>
  );
};

const CurrencySetting = () => {
  const [currency, setCurrency] = useCurrency();

  return (
    <div class="flex justify-between items-center text-sm">
      <label>Currency</label>
      <Select
        value={currency().data ?? DEFAULT_CURRENCY}
        onChange={(val) => setCurrency(val ?? DEFAULT_CURRENCY)}
        options={CURRENCY_OPTIONS}
        itemComponent={(props) => (
          <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
        )}
      >
        <SelectTrigger class="w-32 py-1 h-fit">
          <SelectValue<string>>{(state) => state.selectedOption()}</SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
    </div>
  );
};

const ThemeSetting = () => {
  const { setColorMode } = useColorMode();
  const [theme, setTheme] = useTheme();

  let unsubscribe: () => void;

  onMount(() => {
    unsubscribe = onSystemThemeChange((themeChange) => {
      if (theme().data !== "system") {
        console.info(
          "[UI][onSystemThemeChange] theme is not 'system', update ignored",
        );
        return;
      }

      console.info(
        "[UI][onSystemThemeChange] theme is 'system', updating theme to '%s'",
        themeChange,
      );
      setColorMode(themeChange);
    });
  });

  onCleanup(() => {
    if (unsubscribe) unsubscribe();
  });

  createEffect(() => {
    const newTheme = theme().data;
    if (!newTheme) return;

    if (newTheme === "system") {
      const systemTheme = getSystemTheme();
      console.info(
        "[UI][createEffect] theme is 'system', updating theme to '%s'",
        systemTheme,
      );
      setColorMode(systemTheme);
      return;
    }

    console.info(
      "[UI][createEffect] theme is user-defined, updating theme to '%s'",
      newTheme,
    );
    setColorMode(newTheme as ConfigColorMode);
  });

  return (
    <div class="flex justify-between items-center text-sm">
      <label>Theme</label>
      <Select
        value={theme().data ?? DEFAULT_THEME}
        onChange={(value) => setTheme(value ?? DEFAULT_THEME)}
        options={THEME_OPTIONS}
        itemComponent={(props) => (
          <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
        )}
      >
        <SelectTrigger class="w-32 py-1 h-fit">
          <SelectValue<string>>{(state) => state.selectedOption()}</SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>
    </div>
  );
};

const ClearSettings = () => {
  const clearSettings = async () => {
    await settings.clear();
    queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] });
  };

  return (
    <div class="flex justify-between items-center text-sm">
      <label>Clear Settings</label>

      <ConfirmButton
        title="Are you sure?"
        description="This action will reset all settings to default."
        onConfirm={clearSettings}
      >
        <FaSolidTrash class="w-4 h-4 text-red-500 hover:text-red-600 transition-colors cursor-pointer" />
      </ConfirmButton>
    </div>
  );
};
