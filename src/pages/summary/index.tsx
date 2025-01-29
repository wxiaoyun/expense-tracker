import { DateRangeSetter } from "@/components/dateRangeSetter";
import { useDateRange } from "@/signals/params";
import { Component } from "solid-js";
import { SummaryChart } from "./chart";
import { SummaryTable } from "./table";

export const SummaryPage: Component = () => {
  return (
    <main class="flex flex-col p-2 gap-4 overflow-auto flex-grow">
      <Header />
      <div class="flex flex-col gap-6">
        <SummaryChart />
        <SummaryTable />
      </div>
    </main>
  );
};

const Header = () => {
  const { dateRange } = useDateRange();

  return (
    <header class="relative flex flex-col">
      <div class="flex flex-col text-start">
        <span class="text-xs">
          From <b>{dateRange().start.toDateString()}</b>
        </span>
        <span class="text-xs">
          To <b>{dateRange().end.toDateString()}</b>
        </span>
      </div>

      <DateRangeSetter />
    </header>
  );
};
