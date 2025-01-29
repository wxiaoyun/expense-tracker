import { createSignal, JSX, onMount, Show } from "solid-js";
import { Loader } from "./loader";

type AppLauncherProps = {
  init: () => Promise<void>;
  loader?: JSX.Element;
  children: JSX.Element;
};

export const AppLauncher = (props: AppLauncherProps) => {
  const [isLoading, setIsLoading] = createSignal(false);

  onMount(async () => {
    setIsLoading(true);
    await props.init();
    setIsLoading(false);
  });

  return (
    <Show when={!isLoading()} fallback={props.loader ?? <Loader />}>
      {props.children}
    </Show>
  );
};
