import { Separator } from "@/components/ui/separator";
import { ParentProps } from "solid-js";

type GroupProps = ParentProps<{
  title: string;
}>;

export const Group = (props: GroupProps) => {
  return (
    <div class="flex flex-col gap-4 rounded-md border border-accent p-2">
      <div class="flex flex-col gap-2">
        <h2 class="text-base font-medium ml-2">{props.title}</h2>
        <Separator />
      </div>
      <div class="flex flex-col gap-4 px-2">{props.children}</div>
    </div>
  );
};
