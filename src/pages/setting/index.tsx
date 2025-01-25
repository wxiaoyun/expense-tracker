import { DataGroup } from "./groups/data";
import { DevGroup } from "./groups/dev";
import { MiscGroup } from "./groups/misc";
import { SettingsGroup } from "./groups/settings";

export const SettingPage = () => {
  return (
    <main class="flex flex-col p-2 gap-4 overflow-y-auto">
      <Header />
      <div class="flex flex-col gap-6">
        <DevGroup />
        <DataGroup />
        <SettingsGroup />
        <MiscGroup />
      </div>
    </main>
  );
};

const Header = () => {
  return (
    <header>
      <h1 class="text-lg font-semibold ml-2">Settings</h1>
    </header>
  );
};
