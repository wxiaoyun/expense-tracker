import { createSignal, lazy } from "solid-js";
import { Group } from "../components/group";

export const DevGroup = lazy(async () => {
  if (process.env.NODE_ENV !== "development") {
    return { default: () => null };
  }

  const Comp = () => {
    return (
      <Group title="Development">
        <div class="flex flex-col gap-4">
          <SeedData />
        </div>
      </Group>
    );
  };

  return { default: Comp };
});

const SeedData = lazy(async () => {
  const { generateTransactions } = await import("@/utils/seed");
  const { FaSolidSeedling } = await import("solid-icons/fa");

  const Comp = () => {
    const [count, setCount] = createSignal(100);

    const handleSeedData = async () => {
      await generateTransactions(count());
    };

    return (
      <div class="flex justify-between items-center text-sm">
        <label>Seed data</label>
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
