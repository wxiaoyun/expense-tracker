import { ParentComponent } from "solid-js";
import { AppLauncher } from "./components/launcher";
import { NavBar } from "./components/navbar";
import { initializePaths } from "./libs/fs";
import { incurDueRecurringTransactions } from "./utils/recurring-transactions";

const init = async () => {
  const res = await Promise.allSettled([
    initializePaths(),
    incurDueRecurringTransactions(),
  ]);

  if (res.every((r) => r.status === "fulfilled")) {
    console.info("[APP] App initialized");
    return;
  }

  console.error(
    "[APP] Failed to initialize paths or incur due recurring transactions",
  );
  throw new Error("Failed to initialize app");
};

export const AppLayout: ParentComponent = (props) => {
  return (
    <AppLauncher init={init}>
      <div class="h-[100dvh] w-full flex flex-col justify-between">
        {props.children}
        <NavBar class="grow-0 w-full" />
      </div>
    </AppLauncher>
  );
};
