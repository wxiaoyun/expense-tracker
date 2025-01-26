import { createSignal, lazy } from "solid-js";
import { SettingGroup } from "../components/group";

export const DevGroup = lazy(async () => {
  if (process.env.NODE_ENV !== "development") {
    return { default: () => null };
  }

  const Comp = () => {
    return (
      <SettingGroup title="Development">
        <div class="flex flex-col gap-4">
          <SeedTransactions />
          <SeedRecurringTransactions />
        </div>
      </SettingGroup>
    );
  };

  return { default: Comp };
});

const SeedTransactions = lazy(async () => {
  const { generateTransactions } = await import("@/utils/seed");
  const { FaSolidSeedling } = await import("solid-icons/fa");

  const Comp = () => {
    const [count, setCount] = createSignal(100);

    const handleSeedData = async () => {
      await generateTransactions(count());
    };

    return (
      <div class="flex justify-between items-center">
        <label>Seed transactions</label>
        <div class="flex items-center gap-2">
          <input
            type="number"
            value={count()}
            onInput={(e) => setCount(Number(e.target.value))}
            class="w-16"
          />
          <FaSolidSeedling
            class="w-4 h-4 cursor-pointer"
            onClick={handleSeedData}
          />
        </div>
      </div>
    );
  };

  return { default: Comp };
});

const SeedRecurringTransactions = lazy(async () => {
  const { generateRecurringTransactions } = await import("@/utils/seed");
  const { FaSolidSeedling } = await import("solid-icons/fa");

  const Comp = () => {
    const [count, setCount] = createSignal(10);

    const handleSeedData = async () => {
      await generateRecurringTransactions(count());
    };

    return (
      <div class="flex justify-between items-center">
        <label>Seed recurring transactions</label>
        <div class="flex items-center gap-2">
          <input
            type="number"
            value={count()}
            onInput={(e) => setCount(Number(e.target.value))}
            class="w-16"
          />
          <FaSolidSeedling
            class="w-4 h-4 cursor-pointer"
            onClick={handleSeedData}
          />
        </div>
      </div>
    );
  };

  return { default: Comp };
});
