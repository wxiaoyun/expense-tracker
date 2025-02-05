import { DateRangeSetter } from "@/components/dateRangeSetter";
import { Badge } from "@/components/ui/badge";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TextField, TextFieldRoot } from "@/components/ui/textfield";
import { formatCurrency } from "@/libs/currency";
import {
  createTransactionCategoriesQuery,
  createTransactionSummarizeQuery,
} from "@/query/transactions";
import {
  useDateRange,
  useSearchTransactionParams,
  useTransactionCategoryParams,
} from "@/signals/params";
import { useCurrency } from "@/signals/setting";
import { debounce } from "lodash";
import { FaSolidPlus } from "solid-icons/fa";
import { IoClose, IoSearch } from "solid-icons/io";
import { VsSettings } from "solid-icons/vs";
import { createMemo, createSignal, For } from "solid-js";
import { DOMElement } from "solid-js/jsx-runtime";
import { TransactionTable } from "./table";

export * from "./edit";
export * from "./new";
export * from "./recurring";

export const TransactionPage = () => {
  return (
    <main class="flex flex-col p-2 overflow-auto flex-grow">
      <Header />
      <Separator />
      <IntervalSummary />
      <Separator />
      <TransactionTable />
    </main>
  );
};

const Header = () => {
  const { dateRange } = useDateRange();

  return (
    <header class="relative flex flex-col">
      <div class="flex justify-between items-center gap-2">
        <div class="flex flex-col text-start">
          <span class="text-xs">
            From <b>{dateRange().start.toDateString()}</b>
          </span>
          <span class="text-xs">
            To <b>{dateRange().end.toDateString()}</b>
          </span>
        </div>
        <div class="flex items-center gap-2">
          <a href="/transactions/new">
            <FaSolidPlus
              class="cursor-pointer hover:opacity-65 transition-opacity"
              size={24}
            />
          </a>

          <Sheet>
            <SheetTrigger>
              <VsSettings size={24} />
            </SheetTrigger>
            <CategoryFilter />
          </Sheet>
        </div>
      </div>

      <DateRangeSetter />
    </header>
  );
};

const IntervalSummary = () => {
  const { dateRange } = useDateRange();
  const [currency] = useCurrency();
  const query = createTransactionSummarizeQuery(dateRange);

  const summary = createMemo(() => {
    const summary = query.data ?? { income: 0, expense: 0, balance: 0 };

    return Object.fromEntries(
      Object.entries(summary).map(([key, value]) => [
        key,
        formatCurrency(value, {
          currency: currency(),
        }),
      ]),
    );
  });

  return (
    <section class="p-1 flex justify-around">
      <div class="flex flex-col items-center">
        <h3>Income</h3>
        <p class="text-green-500">{summary().income}</p>
      </div>

      <div class="flex flex-col items-center">
        <h3>Expense</h3>
        <p class="text-red-500">{summary().expense}</p>
      </div>

      <div class="flex flex-col items-center">
        <h3>Balance</h3>
        <p class="text-blue-500">{summary().balance}</p>
      </div>
    </section>
  );
};

const CategoryFilter = () => {
  const [currentQuery, setQuery] = useSearchTransactionParams();
  const [localQuery, setLocalQuery] = createSignal(currentQuery());

  const debouncedSetQuery = debounce(setQuery, 300);

  const handleChange = (
    e: InputEvent & {
      currentTarget: HTMLInputElement;
      target: DOMElement;
    },
  ) => {
    setLocalQuery(e.currentTarget.value);
    debouncedSetQuery(e.currentTarget.value);
  };

  const [selectedCategories, setSelectedCategories] =
    useTransactionCategoryParams();

  const categoriesQuery = createTransactionCategoriesQuery();
  const categories = createMemo(() => {
    const data = categoriesQuery.data ?? [];
    return data.map((category) => category.category);
  });

  return (
    <SheetContent class="flex flex-col gap-2">
      <SheetHeader>
        <SheetTitle>Advanced Filter</SheetTitle>
        <SheetDescription class="text-sm text-left">
          Search for transactions or filter by category
        </SheetDescription>
      </SheetHeader>

      <div class="flex items-center gap-2 self-center">
        <TextFieldRoot>
          <TextField
            placeholder="Search"
            value={localQuery()}
            onInput={handleChange}
          />
        </TextFieldRoot>
        <IoSearch
          class="cursor-pointer hover:opacity-65 transition-opacity"
          size={20}
          onClick={() => setQuery(localQuery())}
        />
      </div>

      <Combobox<string>
        multiple
        options={categories()}
        value={selectedCategories()}
        onChange={(value) => setSelectedCategories(value)}
        itemComponent={(props) => (
          <ComboboxItem {...props}>{props.item.rawValue}</ComboboxItem>
        )}
        placeholder="Select categories"
      >
        <ComboboxTrigger class="w-fit">
          <ComboboxInput class="py-1" />
        </ComboboxTrigger>
        <ComboboxContent class="overflow-y-auto max-h-[200px]" />
      </Combobox>

      <div class="flex flex-wrap gap-2">
        <For each={selectedCategories()}>
          {(category) => {
            const handleRemove = () => {
              setSelectedCategories(
                selectedCategories().filter((c) => c !== category),
              );
            };

            return (
              <Badge variant="secondary" class="flex items-center gap-1">
                <span>{category}</span>
                <IoClose size={12} onClick={handleRemove} />
              </Badge>
            );
          }}
        </For>
      </div>
    </SheetContent>
  );
};
