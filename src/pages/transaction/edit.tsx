import { toastError, toastSuccess } from "@/components/toast";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  DatePicker,
  DatePickerContent,
  DatePickerContext,
  DatePickerControl,
  DatePickerInput,
  DatePickerPositioner,
  DatePickerRangeText,
  DatePickerTable,
  DatePickerTableBody,
  DatePickerTableCell,
  DatePickerTableCellTrigger,
  DatePickerTableHead,
  DatePickerTableHeader,
  DatePickerTableRow,
  DatePickerTrigger,
  DatePickerView,
  DatePickerViewControl,
  DatePickerViewTrigger,
} from "@/components/ui/date-picker";
import {
  TextField,
  TextFieldLabel,
  TextFieldRoot,
} from "@/components/ui/textfield";
import transactions from "@/db/transactions";
import { queryClient } from "@/query/query";
import {
  createTransactionCategoriesQuery,
  createTransactionQuery,
  TRANSACTIONS_QUERY_KEY,
} from "@/query/transactions";
import { CalendarDate } from "@internationalized/date";
import { useNavigate, useParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { TbArrowLeft } from "solid-icons/tb";
import { createEffect, createMemo, createSignal, Index, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { otherCategory } from "./new";

export const EditTransactionPage = () => {
  return (
    <main class="flex flex-col p-2 overflow-y-auto">
      <Header />
      <EditTransactionForm />
    </main>
  );
};

const Header = () => {
  const navigate = useNavigate();
  return (
    <header class="flex items-center mb-4">
      <TbArrowLeft
        class="cursor-pointer hover:opacity-65 transition-opacity"
        size={20}
        onClick={() => navigate(-1)}
      />
      <h1 class="text-lg font-semibold ml-2">Edit Transaction</h1>
    </header>
  );
};

const EditTransactionForm = () => {
  const params = useParams();
  const navigate = useNavigate();

  const query = createTransactionQuery(() => Number(params.id));
  const categoriesQuery = createTransactionCategoriesQuery();
  const categories = createMemo(() => {
    const categories = (categoriesQuery.data ?? []).map(
      (category) => category.category,
    );
    categories.push(otherCategory);
    return categories;
  });

  const [amount, setAmount] = createSignal(0);
  const [date, setDate] = createSignal(
    new CalendarDate(new Date().getFullYear(), 0, 0),
  );
  const [description, setDescription] = createSignal("");
  const [category, setCategory] = createSignal("");
  const [newCategory, setNewCategory] = createSignal("");

  createEffect(() => {
    if (!query.data || !query.isSuccess) {
      return;
    }

    setAmount(Math.round(query.data.amount * 100) / 100);
    const date = new Date(query.data.transaction_date);
    setDate(
      new CalendarDate(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    setDescription(query.data.description || "");
    setCategory(query.data.category);
  });

  const mutation = createMutation(() => ({
    mutationFn: async () => {
      if (!query.data) return null;
      return transactions.update({
        ...query.data,
        amount: Number(amount()),
        transaction_date: new Date(date().toString()).getTime(),
        description: description(),
        category: newCategory() || category(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
      toastSuccess("Transaction updated successfully");
      navigate("/transactions");
    },
    onError: (error) => toastError(error.message),
  }));

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Show when={query.data} fallback={<div>Loading...</div>}>
      <form onSubmit={handleSubmit} class="flex flex-col gap-4">
        <TextFieldRoot>
          <TextFieldLabel>Amount</TextFieldLabel>
          <TextField
            type="number"
            step="0.01"
            placeholder="Amount"
            value={Number(amount())}
            onChange={(e) => setAmount(parseFloat(e.currentTarget.value) || 0)}
            required
          />
        </TextFieldRoot>

        <div class="flex flex-col gap-1">
          <label class="font-medium">Date</label>
          <DatePicker
            value={[date()]}
            onValueChange={(change) => setDate(change.value[0] as CalendarDate)}
            locale="en"
            positioning={{
              placement: "bottom-start",
            }}
          >
            <DatePickerControl class="w-full">
              <DatePickerInput placeholder="Pick a date" />
              <DatePickerTrigger />
            </DatePickerControl>

            <Portal>
              <DatePickerPositioner>
                <DatePickerContent>
                  <DatePickerView view="day">
                    <DatePickerContext>
                      {(context) => {
                        return (
                          <>
                            <DatePickerViewControl>
                              <DatePickerViewTrigger>
                                <DatePickerRangeText />
                              </DatePickerViewTrigger>
                            </DatePickerViewControl>
                            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <DatePickerTable>
                                <DatePickerTableHead>
                                  <DatePickerTableRow>
                                    <Index each={context().weekDays}>
                                      {(weekDay) => (
                                        <DatePickerTableHeader>
                                          {weekDay().short}
                                        </DatePickerTableHeader>
                                      )}
                                    </Index>
                                  </DatePickerTableRow>
                                </DatePickerTableHead>
                                <DatePickerTableBody>
                                  <Index each={context().weeks}>
                                    {(week) => (
                                      <DatePickerTableRow>
                                        <Index each={week()}>
                                          {(day) => (
                                            <DatePickerTableCell value={day()}>
                                              <DatePickerTableCellTrigger>
                                                {day().day}
                                              </DatePickerTableCellTrigger>
                                            </DatePickerTableCell>
                                          )}
                                        </Index>
                                      </DatePickerTableRow>
                                    )}
                                  </Index>
                                </DatePickerTableBody>
                              </DatePickerTable>
                            </div>
                          </>
                        );
                      }}
                    </DatePickerContext>
                  </DatePickerView>
                  <DatePickerView view="month">
                    <DatePickerContext>
                      {(context) => (
                        <>
                          <DatePickerViewControl>
                            <DatePickerViewTrigger>
                              <DatePickerRangeText />
                            </DatePickerViewTrigger>
                          </DatePickerViewControl>
                          <DatePickerTable>
                            <DatePickerTableBody>
                              <Index
                                each={context().getMonthsGrid({
                                  columns: 4,
                                  format: "short",
                                })}
                              >
                                {(months) => (
                                  <DatePickerTableRow>
                                    <Index each={months()}>
                                      {(month) => (
                                        <DatePickerTableCell
                                          value={month().value}
                                        >
                                          <DatePickerTableCellTrigger>
                                            {month().label}
                                          </DatePickerTableCellTrigger>
                                        </DatePickerTableCell>
                                      )}
                                    </Index>
                                  </DatePickerTableRow>
                                )}
                              </Index>
                            </DatePickerTableBody>
                          </DatePickerTable>
                        </>
                      )}
                    </DatePickerContext>
                  </DatePickerView>
                  <DatePickerView view="year">
                    <DatePickerContext>
                      {(context) => (
                        <>
                          <DatePickerViewControl>
                            <DatePickerViewTrigger>
                              <DatePickerRangeText />
                            </DatePickerViewTrigger>
                          </DatePickerViewControl>
                          <DatePickerTable>
                            <DatePickerTableBody>
                              <Index
                                each={context().getYearsGrid({
                                  columns: 4,
                                })}
                              >
                                {(years) => (
                                  <DatePickerTableRow>
                                    <Index each={years()}>
                                      {(year) => (
                                        <DatePickerTableCell
                                          value={year().value}
                                        >
                                          <DatePickerTableCellTrigger>
                                            {year().label}
                                          </DatePickerTableCellTrigger>
                                        </DatePickerTableCell>
                                      )}
                                    </Index>
                                  </DatePickerTableRow>
                                )}
                              </Index>
                            </DatePickerTableBody>
                          </DatePickerTable>
                        </>
                      )}
                    </DatePickerContext>
                  </DatePickerView>
                </DatePickerContent>
              </DatePickerPositioner>
            </Portal>
          </DatePicker>
        </div>

        <TextFieldRoot>
          <TextFieldLabel>Description</TextFieldLabel>
          <TextField
            placeholder="Description"
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
          />
        </TextFieldRoot>

        <div class="flex flex-col gap-1">
          <label class="font-medium">Category</label>
          <Combobox
            value={category()}
            onChange={(value) => {
              if (value) setCategory(value);
              setNewCategory("");
            }}
            options={categories()}
            placeholder="Select or enter category"
            itemComponent={(props) => (
              <ComboboxItem {...props}>{props.item.rawValue}</ComboboxItem>
            )}
            required
          >
            <ComboboxTrigger>
              <ComboboxInput />
            </ComboboxTrigger>
            <ComboboxContent class="overflow-y-auto max-h-[200px]" />
          </Combobox>
        </div>

        <TextFieldRoot>
          <TextFieldLabel>New category</TextFieldLabel>
          <TextField
            placeholder="New category"
            value={newCategory()}
            onChange={(e) => {
              setCategory(otherCategory);
              setNewCategory(e.currentTarget.value);
            }}
          />
        </TextFieldRoot>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Show>
  );
};
