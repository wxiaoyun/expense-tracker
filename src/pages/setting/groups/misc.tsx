import { openUrl } from "@tauri-apps/plugin-opener";
import { BiSolidCoffeeAlt } from "solid-icons/bi";
import { FaSolidBug, FaSolidStar } from "solid-icons/fa";
import { SettingGroup } from "../components/group";

export const MiscGroup = () => {
  return (
    <SettingGroup title="Miscellaneous">
      <div class="flex flex-col gap-3 ">
        <div class="w-full flex items-center justify-between">
          <label>Submit bug report</label>
          <FaSolidBug
            size={24}
            class="cursor-pointer hover:opacity-65 transition-opacity"
            onClick={() => openUrl(GITHUB_ISSUE_URL)}
          />
        </div>

        <div class="flex items-center justify-between">
          <label>Star on GitHub</label>
          <FaSolidStar
            size={24}
            class="cursor-pointer hover:opacity-65 transition-opacity"
            onClick={() => openUrl(GITHUB_URL)}
          />
        </div>

        <div class="flex items-center justify-between">
          <label>Buy me a coffee</label>
          <BiSolidCoffeeAlt
            size={24}
            class="cursor-pointer hover:opacity-65 transition-opacity"
            onClick={() => openUrl(BUY_ME_A_COFFEE_URL)}
          />
        </div>
      </div>
    </SettingGroup>
  );
};
