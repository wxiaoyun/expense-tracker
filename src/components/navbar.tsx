import { Separator } from "@/components/ui/separator";
import { FaSolidArrowRotateRight, FaSolidMoneyBill } from "solid-icons/fa";
import { IoStatsChart } from "solid-icons/io";
import { RiSystemSettings3Fill } from "solid-icons/ri";
import { Component, ComponentProps } from "solid-js";

export const NavBar: Component<ComponentProps<"nav">> = (props) => {
  const date = new Date();
  return (
    <nav {...props}>
      <Separator />
      <div class="p-3 flex justify-around">
        <a
          class="cursor-pointer hover:opacity-65 transition-opacity flex flex-col items-center"
          href="/"
          aria-label="Home"
        >
          <FaSolidMoneyBill size={32} />
          <label class="text-xs">{`${date.getDate()}/${date.getMonth() + 1}`}</label>
        </a>
        <a
          class="cursor-pointer hover:opacity-65 transition-opacity flex flex-col items-center"
          href="/transactions/recurring"
          aria-label="Recurring Transactions"
        >
          <FaSolidArrowRotateRight size={32} />
          <label class="text-xs">Recurring</label>
        </a>
        <a
          class="cursor-pointer hover:opacity-65 transition-opacity flex flex-col items-center"
          href="/summary"
          aria-label="Summary"
        >
          <IoStatsChart size={32} />
          <label class="text-xs">Summary</label>
        </a>
        <a
          class="cursor-pointer hover:opacity-65 transition-opacity flex flex-col items-center"
          href="/settings"
          aria-label="Settings"
        >
          <RiSystemSettings3Fill size={32} />
          <label class="text-xs">Settings</label>
        </a>
      </div>
    </nav>
  );
};
