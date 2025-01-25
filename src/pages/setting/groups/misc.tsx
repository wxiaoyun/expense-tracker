import {
  BUY_ME_A_COFFEE_URL,
  GITHUB_ISSUE_URL,
  GITHUB_URL,
} from "@/constants/url";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FiExternalLink } from "solid-icons/fi";
import { SettingGroup } from "../components/group";

export const MiscGroup = () => {
  return (
    <SettingGroup title="Miscellaneous">
      <div class="flex flex-col gap-3 text-sm">
        <div class="w-full flex items-center justify-between">
          <label>Submit bug report</label>
          <FiExternalLink
            class="w-4 h-4 cursor-pointer hover:opacity-65 transition-opacity"
            onClick={() => openUrl(GITHUB_ISSUE_URL)}
          />
        </div>

        <div class="flex items-center justify-between">
          <label>Star on GitHub</label>
          <FiExternalLink
            class="w-4 h-4 cursor-pointer hover:opacity-65 transition-opacity"
            onClick={() => openUrl(GITHUB_URL)}
          />
        </div>

        <div class="flex items-center justify-between">
          <label>Buy me a coffee</label>
          <FiExternalLink
            class="w-4 h-4 cursor-pointer hover:opacity-65 transition-opacity"
            onClick={() => openUrl(BUY_ME_A_COFFEE_URL)}
          />
        </div>
      </div>
    </SettingGroup>
  );
};
