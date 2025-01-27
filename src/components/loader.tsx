import { TbLoader2 } from "solid-icons/tb";

export const Loader = () => {
  return (
    <div class="flex flex-col items-center justify-center h-[100dvh]">
      <TbLoader2 size={48} class="animate-spin" />
    </div>
  );
};
