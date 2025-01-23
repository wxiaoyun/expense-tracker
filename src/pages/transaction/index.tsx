import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FaSolidPlus } from "solid-icons/fa";
import { IoFilterCircle, IoSearch } from "solid-icons/io";
import { TbChevronLeft, TbChevronRight } from "solid-icons/tb";

export const Transaction = () => {
  return (
    <main class="">
      <Header />
      <TimeShift />
      <Separator />
      <IntervalSummary />
      <Separator />
    </main>
  );
};

const Header = () => {
  return (
    <section class="relative p-2 flex justify-between">
      <div class="flex">
        <Button variant="ghost">
          <FaSolidPlus size={20} />
        </Button>
      </div>
      <h1 class="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2">
        Transactions
      </h1>
      <div class="flex">
        <Button variant="ghost">
          <IoSearch size={20} />
        </Button>
        <Button variant="ghost">
          <IoFilterCircle size={20} />
        </Button>
      </div>
    </section>
  );
};

const TimeShift = () => {
  const date = new Date();
  return (
    <section class="relative p-2 flex justify-between">
      <Button variant="ghost">
        <TbChevronLeft size={20} />
      </Button>
      <h2 class="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2">
        {date.toDateString()}
      </h2>
      <Button variant="ghost">
        <TbChevronRight size={20} />
      </Button>
    </section>
  );
};

const IntervalSummary = () => {
  return (
    <section class="p-2 flex justify-around text-sm">
      <div class="flex flex-col items-center">
        <h3>Income</h3>
        <p>$0.00</p>
      </div>

      <div class="flex flex-col items-center">
        <h3>Expense</h3>
        <p>$0.00</p>
      </div>

      <div class="flex flex-col items-center">
        <h3>Balance</h3>
        <p>$0.00</p>
      </div>
    </section>
  );
};
