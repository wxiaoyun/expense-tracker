import { createSignal, JSX, onCleanup, onMount, Show } from "solid-js";
import { Loader } from "./loader";

type AppLauncherProps = {
  init: () => Promise<void>;
  onVisibilityChange?: () => void;
  loader?: JSX.Element;
  children: JSX.Element;
};

export const AppLauncher = (props: AppLauncherProps) => {
  const [isLoading, setIsLoading] = createSignal(false);

  onMount(async () => {
    setIsLoading(true);
    await props.init();
    setIsLoading(false);

    if (props.onVisibilityChange) {
      document.addEventListener("visibilitychange", props.onVisibilityChange);
    }
  });

  onCleanup(() => {
    if (props.onVisibilityChange) {
      document.removeEventListener(
        "visibilitychange",
        props.onVisibilityChange,
      );
    }
  });

  return (
    <Show when={!isLoading()} fallback={props.loader ?? <Loader />}>
      {props.children}
    </Show>
  );
};
