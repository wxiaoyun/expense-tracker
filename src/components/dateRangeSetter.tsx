import { cn } from "@/libs/cn";
import { DateRange, dateRangeOptions, shiftDate } from "@/libs/date";
import { useDateRange } from "@/signals/params";
import { TbChevronLeft, TbChevronRight } from "solid-icons/tb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export const DateRangeSetter = () => {
  const {
    currentDate: date,
    currentRange: range,
    setDate,
    setRange,
  } = useDateRange();

  const shift = (amount: number) => {
    const newDate = shiftDate(date(), range(), amount);
    setDate(newDate);
  };

  const shiftLeftIfNotAll = () => {
    if (range() !== "all") shift(-1);
  };

  const shiftRightIfNotAll = () => {
    if (range() !== "all") shift(1);
  };

  return (
    <div class="relative p-1 flex justify-center gap-3 items-center">
      <TbChevronLeft
        class={cn(
          "cursor-pointer hover:opacity-65 transition-opacity",
          range() === "all" && "opacity-50 cursor-not-allowed",
        )}
        size={32}
        onClick={shiftLeftIfNotAll}
      />

      <Select
        options={dateRangeOptions}
        value={range()}
        onChange={(value) => setRange(value as DateRange)}
        itemComponent={(props) => (
          <SelectItem item={props.item}>
            {props.item.rawValue.charAt(0).toUpperCase() +
              props.item.rawValue.slice(1)}
          </SelectItem>
        )}
        class="h-fit"
      >
        <SelectTrigger class="w-32 h-8">
          <SelectValue<DateRange>>
            {(state) =>
              state.selectedOption()?.charAt(0).toUpperCase() +
              state.selectedOption()?.slice(1)
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent />
      </Select>

      <TbChevronRight
        class={cn(
          "cursor-pointer hover:opacity-65 transition-opacity",
          range() === "all" && "opacity-50 cursor-not-allowed",
        )}
        size={32}
        onClick={shiftRightIfNotAll}
      />
    </div>
  );
};
