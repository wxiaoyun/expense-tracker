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
import { RECURRING_TRANSACTIONS_QUERY_KEY } from "@/query/recurring-transactions";
import { useTransactionCategories } from "@/signals/transactions";
import { CalendarDate } from "@internationalized/date";
import { useNavigate } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { TbArrowLeft } from "solid-icons/tb";
import { createMemo, createSignal, Index, Show } from "solid-js";
import { Portal } from "solid-js/web";

export const NewRecurringTransactionPage = () => {
  return (
    <main class="flex flex-col p-2 overflow-y-auto flex-grow">
      <Header />
      <NewForm />
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
      <h1 class="text-lg font-semibold ml-2">New Recurring Transaction</h1>
    </header>
  );
};

const NewForm = () => {
  const navigate = useNavigate();
  const categories = useTransactionCategories();

  const [amount, setAmount] = createSignal("");
  const [startDate, setStartDate] = createSignal(
    new CalendarDate(new Date().getFullYear(), 0, 0),
  );
  const [category, setCategory] = createSignal("");
  const [newCategory, setNewCategory] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [recurrenceValue, setRecurrenceValue] = createSignal("");

  const isCategoryValid = createMemo(() => {
    return category() !== "" || newCategory() !== "";
  });
  const isAmountValid = createMemo(() => {
    const amt = Number(amount());
    return !isNaN(amt) && isFinite(amt);
  });
  const isRecurrenceValueValid = createMemo(() =>
    validateOccurrence(recurrenceValue()),
  );

  const isAllFieldsValid = createMemo(() => {
    return isAmountValid() && isRecurrenceValueValid().ok && isCategoryValid();
  });

  const mutation = createMutation(() => ({
    mutationFn: async () => {
      return recurringTransactions.create({
        amount: Number(amount()),
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
      console.error("[UI] Error creating recurring transaction %o", error);
      toastError(error.message);
    },
  }));

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!isAllFieldsValid()) return;
    mutation.mutate();
  };

  return (
    <form class="flex flex-col gap-4" onSubmit={handleSubmit}>
      <TextFieldRoot validationState={isAmountValid() ? "valid" : "invalid"}>
        <TextFieldLabel>Amount</TextFieldLabel>
        <TextField
          placeholder="Amount"
          value={amount()}
          onChange={(e) => setAmount(e.currentTarget.value)}
          required
        />
        <Show when={!isAmountValid()}>
          <TextFieldErrorMessage>
            Amount must be a valid number
          </TextFieldErrorMessage>
        </Show>
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
            <DatePickerInput placeholder="Pick a date" disabled />
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
                                      <DatePickerTableCell value={year().value}>
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

      <TextFieldRoot validationState={isCategoryValid() ? "valid" : "invalid"}>
        <TextFieldLabel>New category</TextFieldLabel>
        <TextField
          placeholder="New category"
          value={newCategory()}
          onChange={(e) => {
            setCategory("");
            setNewCategory(e.currentTarget.value);
          }}
        />
        <Show when={!isCategoryValid()}>
          <TextFieldErrorMessage>
            Either select a category or enter a new one
          </TextFieldErrorMessage>
        </Show>
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
        disabled={mutation.isPending || !isAllFieldsValid()}
      >
        {mutation.isPending ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
};
