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
import { confirmationCallback } from "@/libs/dialog";
import { queryClient } from "@/query";
import { SETTINGS_QUERY_KEY } from "@/query/settings";
import { useCurrency, useTheme } from "@/signals/setting";
import { ConfigColorMode, useColorMode } from "@kobalte/core";
import { FaSolidTrash } from "solid-icons/fa";
import { createEffect } from "solid-js";
import { SettingGroup } from "../components/group";

export const ConfigGroup = () => {
  return (
    <SettingGroup title="Settings">
      <div class="flex flex-col gap-4">
        <CurrencySetting />
        <ThemeSetting />
        <ClearSettings />
      </div>
    </SettingGroup>
  );
};

const CurrencySetting = () => {
  const [currency, setCurrency] = useCurrency();

  return (
    <div class="flex justify-between items-center">
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

  createEffect(() => {
    const newTheme = theme().data;
    if (!newTheme) return;

    console.info("[UI][createEffect] updating theme to '%s'", newTheme);
    setColorMode(newTheme as ConfigColorMode);
  });

  return (
    <div class="flex justify-between items-center">
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
  const handleClearSettings = confirmationCallback(
    "This action will reset all settings to default.",
    {
      title: "Are you sure?",
      okLabel: "Clear",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        await settings.clear();
        queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] });
      },
    },
  );

  return (
    <div class="flex justify-between items-center">
      <label>Clear Settings</label>

      <FaSolidTrash
        class="w-4 h-4 text-red-500 hover:text-red-600 transition-colors cursor-pointer"
        onClick={handleClearSettings}
      />
    </div>
  );
};
