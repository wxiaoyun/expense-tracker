import { confirm } from "@tauri-apps/plugin-dialog";

// https://tauri.app/plugin/dialog/

type Options = {
  title?: string;
  kind?: "warning" | "error" | "info";
  okLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
};

export const confirmationCallback = (description: string, options: Options) => {
  return async () => {
    const confirmed = await confirm(description, {
      title: options.title,
      kind: options.kind ?? "warning",
      okLabel: options.okLabel,
      cancelLabel: options.cancelLabel,
    });

    if (confirmed) {
      console.log("[Dialog] Confirmation Dialog Confirmed");
      const res = options.onConfirm();
      if (res instanceof Promise) await res;
      return true;
    }

    console.log("[Dialog] Confirmation Dialog Cancelled");
    const res = options.onCancel?.();
    if (res instanceof Promise) await res;
    return false;
  };
};
