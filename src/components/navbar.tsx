import { Separator } from "@/components/ui/separator";
import { cn } from "@/libs/cn";
import { useLocation } from "@solidjs/router";
import { FaSolidArrowRotateRight, FaSolidMoneyBill } from "solid-icons/fa";
import { IoStatsChart } from "solid-icons/io";
import { RiSystemSettings3Fill } from "solid-icons/ri";
import { Component, ComponentProps, JSX } from "solid-js";

export const NavBar: Component<ComponentProps<"nav">> = (props) => {
  const date = new Date();
  return (
    <nav {...props}>
      <Separator />
      <div class="p-2 flex justify-around">
        <NavBarItem
          icon={<FaSolidMoneyBill size={32} />}
          label={`${date.getDate()}/${date.getMonth() + 1}`}
          href="/"
        />
        <NavBarItem
          icon={<FaSolidArrowRotateRight size={32} />}
          label="Recurring"
          href="/transactions/recurring"
        />
        <NavBarItem
          icon={<IoStatsChart size={32} />}
          label="Summary"
          href="/summary"
        />
        <NavBarItem
          icon={<RiSystemSettings3Fill size={32} />}
          label="Settings"
          href="/settings"
        />
      </div>
    </nav>
  );
};

const NavBarItem = (props: {
  icon: JSX.Element;
  label: string;
  href: string;
}) => {
  const location = useLocation();
  const isActive = () => location.pathname === props.href;

  return (
    <a
      class={cn(
        "cursor-pointer flex flex-col items-center transition-opacity",
        !isActive() && "opacity-50",
      )}
      href={props.href}
      aria-label={props.label}
    >
      {props.icon}
      <label class="text-xs">{props.label}</label>
    </a>
  );
};
