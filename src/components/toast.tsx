import {
  Toast,
  ToastContent,
  ToastDescription,
  ToastProgress,
  ToastTitle,
} from "@/components/ui/toast";
import { toaster } from "@kobalte/core";

export const toastSuccess = (msg: string) => {
  toaster.show((props) => (
    <Toast {...props}>
      <ToastContent>
        <ToastTitle>Success</ToastTitle>
        <ToastDescription>{msg}</ToastDescription>
      </ToastContent>
      <ToastProgress />
    </Toast>
  ));
};

export const toastError = (msg: string) => {
  toaster.show((props) => (
    <Toast {...props}>
      <ToastContent>
        <ToastTitle>Error</ToastTitle>
        <ToastDescription>{msg}</ToastDescription>
      </ToastContent>
      <ToastProgress />
    </Toast>
  ));
};

export const toastWithTitle = (title: string, msg: string) => {
  toaster.show((props) => (
    <Toast {...props}>
      <ToastContent>
        <ToastTitle>{title}</ToastTitle>
        <ToastDescription>{msg}</ToastDescription>
      </ToastContent>
    </Toast>
  ));
};
