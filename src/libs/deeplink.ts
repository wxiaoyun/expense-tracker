import { onOpenUrl } from "@tauri-apps/plugin-deep-link";

// https://tauri.app/plugin/deep-linking/

export const initDeepLinkHandler = onOpenUrl((urls) => {
  console.info("[DeepLink] TODO: handle deep link %o", urls);
});
