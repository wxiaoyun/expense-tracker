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
  TextFieldErrorMessage,
  TextFieldLabel,
  TextFieldRoot,
} from "@/components/ui/textfield";
import { recurringTransactions } from "@/db";
import { validateOccurrence } from "@/libs/date";
import { queryClient } from "@/query";
import {
  createRecurringTransactionQuery,
  RECURRING_TRANSACTIONS_QUERY_KEY,
} from "@/query/recurring-transactions";
import { createTransactionCategoriesQuery } from "@/query/transactions";
import { CalendarDate } from "@internationalized/date";
import { useNavigate, useParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { TbArrowLeft } from "solid-icons/tb";
import { createEffect, createMemo, createSignal, Index, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { otherCategory } from "../new";

export const EditRecurringTransactionPage = () => {
  return (
    <main class="flex flex-col p-2 overflow-y-auto">
      <Header />
      <EditForm />
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
      <h1 class="text-lg font-semibold ml-2">Edit Recurring Transaction</h1>
    </header>
  );
};

const EditForm = () => {
  const params = useParams();
  const navigate = useNavigate();

  const query = createRecurringTransactionQuery(() => Number(params.id));
  const categoriesQuery = createTransactionCategoriesQuery();
  const categories = createMemo(() => {
    const categories = (categoriesQuery.data ?? []).map(
      (category) => category.category,
    );
    categories.push(otherCategory);
    return categories;
  });

  const [amount, setAmount] = createSignal(0);
  const [startDate, setStartDate] = createSignal(
    new CalendarDate(new Date().getFullYear(), 0, 0),
  );
  const [category, setCategory] = createSignal("");
  const [newCategory, setNewCategory] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [recurrenceValue, setRecurrenceValue] = createSignal("");
  const isRecurrenceValueValid = createMemo(() =>
    validateOccurrence(recurrenceValue()),
  );

  createEffect(() => {
    if (!query.isSuccess || !query.data) return;

    const transaction = query.data;
    const startDate = new Date(transaction.start_date);
    const startDateYear = startDate.getFullYear();
    const startDateMonth = startDate.getMonth();
    const startDateDay = startDate.getDate();
    setAmount(Math.round(transaction.amount * 100) / 100);
    setStartDate(new CalendarDate(startDateYear, startDateMonth, startDateDay));
    setCategory(transaction.category);
    setDescription(transaction.description ?? "");
    setRecurrenceValue(transaction.recurrence_value);
  });

  const mutation = createMutation(() => ({
    mutationFn: async () => {
      if (!query.data) return null;
      await recurringTransactions.update({
        ...query.data,
        amount: amount(),
        start_date: new Date(startDate().toString()).getTime(),
        category: newCategory() || category(),
        description: description(),
        recurrence_value: recurrenceValue(),
      });
    },
    onSuccess: () => {
      toastSuccess("Recurring transaction updated successfully");
      navigate(`/transactions/recurring`);
      queryClient.invalidateQueries({
        queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY],
      });
    },
    onError: (error) => {
      toastError(error.message);
    },
  }));

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Show when={query.isSuccess && query.data}>
      <form class="flex flex-col gap-4" onSubmit={handleSubmit}>
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
          <label class="font-medium">Start Date</label>
          <DatePicker
            value={[startDate()]}
            onValueChange={(change) =>
              setStartDate(change.value[0] as CalendarDate)
            }
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

        <TextFieldRoot
          validationState={isRecurrenceValueValid().ok ? "valid" : "invalid"}
        >
          <TextFieldLabel>Recurrence Value</TextFieldLabel>
          <TextField
            placeholder="Recurrence Value"
            value={recurrenceValue()}
            onChange={(e) => setRecurrenceValue(e.currentTarget.value)}
            required
          />
          <Show when={!isRecurrenceValueValid().ok}>
            <TextFieldErrorMessage>
              {isRecurrenceValueValid().err}
            </TextFieldErrorMessage>
          </Show>
        </TextFieldRoot>

        <Button
          type="submit"
          disabled={mutation.isPending || !isRecurrenceValueValid().ok}
        >
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Show>
  );
};
