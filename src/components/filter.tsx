import { createTransactionCategoriesQuery } from "@/query/transactions";
import {
  useSearchTransactionParams,
  useTransactionCategoryParams,
  useVerifiedTransactionParams,
} from "@/signals/params";
import { debounce } from "lodash";
import { FaSolidFilter } from "solid-icons/fa";
import { IoClose, IoSearch } from "solid-icons/io";
import { Component, createMemo, createSignal, For, Show } from "solid-js";
import { DOMElement } from "solid-js/jsx-runtime";
import { Badge } from "./ui/badge";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from "./ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { TextField, TextFieldRoot } from "./ui/textfield";

export type ParamsFilterProps = {
  hideVerified?: boolean;
  hideCategories?: boolean;
  hideQuery?: boolean;
};

export const ParamsFilter: Component<ParamsFilterProps> = (props) => {
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

  const [selectedVerified, setSelectedVerified] =
    useVerifiedTransactionParams();

  return (
    <Sheet>
      <SheetTrigger>
        <FaSolidFilter size={24} />
      </SheetTrigger>
      <SheetContent class="flex flex-col gap-2">
        <SheetHeader>
          <SheetTitle>Filter</SheetTitle>
          <SheetDescription class="text-sm text-left">
            Search for transactions or filter by category
          </SheetDescription>
        </SheetHeader>

        <Show when={!props.hideQuery}>
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
        </Show>

        <Show when={!props.hideVerified}>
          <div class="flex items-center gap-2">
            <Select
              options={["All", "Verified", "Unverified"]}
              value={selectedVerified()}
              onChange={(value) => value && setSelectedVerified(value)}
              itemComponent={(props) => (
                <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
              )}
            >
              <SelectTrigger class="w-32 py-1 h-fit">
                <SelectValue<string>>
                  {(state) => state.selectedOption()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>
        </Show>

        <Show when={!props.hideCategories}>
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
        </Show>
      </SheetContent>
    </Sheet>
  );
};
