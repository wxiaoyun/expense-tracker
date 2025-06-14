import { Alert } from 'react-native';

// Using React Native's Alert API for cross-platform dialogs

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
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        options.title || getDefaultTitle(options.kind),
        description,
        [
          {
            text: options.cancelLabel || "Cancel",
            style: "cancel",
            onPress: async () => {
              console.log("[Dialog] Confirmation Dialog Cancelled");
              try {
                const res = options.onCancel?.();
                if (res instanceof Promise) await res;
              } catch (error) {
                console.error("[Dialog] Error in onCancel callback:", error);
              }
              resolve(false);
            },
          },
          {
            text: options.okLabel || "OK",
            style: options.kind === "error" ? "destructive" : "default",
            onPress: async () => {
              console.log("[Dialog] Confirmation Dialog Confirmed");
              try {
                const res = options.onConfirm();
                if (res instanceof Promise) await res;
                resolve(true);
              } catch (error) {
                console.error("[Dialog] Error in onConfirm callback:", error);
                resolve(false);
              }
            },
          },
        ],
        { 
          cancelable: true,
          onDismiss: async () => {
            console.log("[Dialog] Confirmation Dialog Dismissed");
            try {
              const res = options.onCancel?.();
              if (res instanceof Promise) await res;
            } catch (error) {
              console.error("[Dialog] Error in onCancel callback:", error);
            }
            resolve(false);
          }
        }
      );
    });
  };
};

/**
 * Simple confirmation dialog without callbacks - returns a promise
 */
export const showConfirmDialog = async (
  title: string,
  message: string,
  options?: {
    okLabel?: string;
    cancelLabel?: string;
    kind?: "warning" | "error" | "info";
  }
): Promise<boolean> => {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: options?.cancelLabel || "Cancel",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: options?.okLabel || "OK",
          style: options?.kind === "error" ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
};

/**
 * Simple alert dialog for showing information
 */
export const showAlert = async (
  title: string,
  message: string,
  options?: {
    okLabel?: string;
    kind?: "warning" | "error" | "info";
  }
): Promise<void> => {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: options?.okLabel || "OK",
          style: options?.kind === "error" ? "destructive" : "default",
          onPress: () => resolve(),
        },
      ],
      { cancelable: true, onDismiss: () => resolve() }
    );
  });
};

/**
 * Get default title based on dialog kind
 */
const getDefaultTitle = (kind?: "warning" | "error" | "info"): string => {
  switch (kind) {
    case "error":
      return "Error";
    case "warning":
      return "Warning";
    case "info":
      return "Information";
    default:
      return "Confirm";
  }
};

/**
 * Show a dialog with multiple options
 */
export const showActionSheet = async (
  title: string,
  message: string,
  actions: {
    text: string;
    style?: "default" | "cancel" | "destructive";
    onPress: () => void | Promise<void>;
  }[]
): Promise<void> => {
  return new Promise((resolve) => {
    const alertActions = actions.map((action) => ({
      text: action.text,
      style: action.style || "default",
      onPress: async () => {
        try {
          const res = action.onPress();
          if (res instanceof Promise) await res;
        } catch (error) {
          console.error("[Dialog] Error in action callback:", error);
        }
        resolve();
      },
    }));

    Alert.alert(title, message, alertActions, {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
};
