import { cn } from "@/libs/cn";
import { useTransactionChartConfig } from "@/signals/transactions";
import {
  ArcElement,
  Chart,
  Colors,
  DoughnutController,
  Legend,
  Tooltip,
} from "chart.js";
import {
  Component,
  ComponentProps,
  createEffect,
  onCleanup,
  Show,
  splitProps,
} from "solid-js";

Chart.register(Colors, Tooltip, Legend, DoughnutController, ArcElement);

export const SummaryChart: Component<ComponentProps<"div">> = (props) => {
  const [local, rest] = splitProps(props, ["class"]);

  const chartConfig = useTransactionChartConfig();

  let el!: HTMLCanvasElement;
  let chart: Chart | null = null;

  createEffect(() => {
    chart?.destroy();

    const config = chartConfig();
    if (config) {
      chart = new Chart(el, config);
    }
  });

  onCleanup(() => {
    chart?.destroy();
  });

  return (
    <div class={cn("max-w-[500px] w-full mx-auto", local.class)} {...rest}>
      <canvas
        ref={el}
        aria-label="Summary Chart"
        role="img"
        width={300}
        height={300}
        class={cn(chartConfig() ? "block" : "hidden")}
      />
      <Show when={!chartConfig()}>
        <div class="flex items-center justify-center h-full">
          <span class="text-xs text-gray-500">No data</span>
        </div>
      </Show>
    </div>
  );
};
