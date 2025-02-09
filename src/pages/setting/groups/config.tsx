import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch, SwitchControl, SwitchThumb } from "@/components/ui/switch";
import { settings } from "@/db";
import { confirmationCallback } from "@/libs/dialog";
import { invalidateSettingsQuery } from "@/query/settings";
import {
  useClipboardExec,
  useCurrency,
  useTheme,
  useWeekStart,
} from "@/signals/setting";
import { ConfigColorMode, useColorMode } from "@kobalte/core";
import { FaSolidTrash } from "solid-icons/fa";
import { createEffect } from "solid-js";
import { SettingGroup } from "../components/group";

export const ConfigGroup = () => {
  return (
    <SettingGroup title="Settings">
      <div class="flex flex-col gap-4">
        <ThemeSetting />
        <CurrencySetting />
        <WeekStartSetting />
        <ClipboardExecSetting />
        <Separator />
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

      <Combobox
        value={currency()}
        onChange={(value) => value && setCurrency(value)}
        options={CURRENCY_OPTIONS}
        placeholder="Select currency"
        itemComponent={(props) => (
          <ComboboxItem {...props}>{props.item.rawValue}</ComboboxItem>
        )}
        disallowEmptySelection={false}
        required
      >
        <ComboboxTrigger class="w-fit">
          <ComboboxInput class="w-[5.5rem] py-1" />
        </ComboboxTrigger>
        <ComboboxContent class="overflow-y-auto max-h-[200px]" />
      </Combobox>
    </div>
  );
};

const WeekStartSetting = () => {
  const [weekStart, setWeekStart] = useWeekStart();

  return (
    <div class="flex justify-between items-center">
      <label>Week start</label>
      <Select
        value={weekStart()}
        onChange={(value) => value && setWeekStart(value)}
        options={WEEK_START_OPTIONS}
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
    console.info("[UI][createEffect] updating theme to '%s'", theme());
    setColorMode(theme() as ConfigColorMode);
  });

  return (
    <div class="flex justify-between items-center">
      <label>Theme</label>
      <Select
        value={theme()}
        onChange={(value) => value && setTheme(value)}
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

const ClipboardExecSetting = () => {
  const [clipboardExec, setClipboardExec] = useClipboardExec();

  return (
    <div class="flex justify-between items-center">
      <label>Execute clipboard command</label>
      <Switch
        checked={clipboardExec()}
        onChange={(checked) => setClipboardExec(checked)}
      >
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
      </Switch>
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
        invalidateSettingsQuery();
      },
    },
  );

  return (
    <div class="flex justify-between items-center">
      <label>Clear settings</label>

      <FaSolidTrash
        size={24}
        class="text-red-500 hover:text-red-600 transition-colors cursor-pointer"
        onClick={handleClearSettings}
      />
    </div>
  );
};
