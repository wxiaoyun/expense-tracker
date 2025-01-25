import { ConfirmButton } from "@/components/confirmButton";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TextField,
  TextFieldErrorMessage,
  TextFieldLabel,
  TextFieldRoot,
} from "@/components/ui/textfield";
import { IntervalToText } from "@/constants/date";
import { recurringTransactions } from "@/db";
import {
  recurrenceRegularValues,
  RecurrenceType,
  recurrenceTypes,
} from "@/db/recurring_transactions";
import { queryClient } from "@/query";
import { RECURRING_TRANSACTIONS_QUERY_KEY } from "@/query/recurring-transactions";
import { createTransactionCategoriesQuery } from "@/query/transactions";
import { validateOccurrence } from "@/utils/date";
import { CalendarDate } from "@internationalized/date";
import { useNavigate } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { TbArrowLeft } from "solid-icons/tb";
import { createMemo, createSignal, Index, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { otherCategory } from "../new";

export const NewRecurringTransactionPage = () => {
  return (
    <main class="flex flex-col p-2 overflow-y-auto">
      <Header />
      <NewForm />
    </main>
  );
};

const Header = () => {
  const navigate = useNavigate();
  return (
    <header class="flex items-center mb-4">
      <ConfirmButton
        title="Are you sure?"
        description="Your changes will be lost if you leave this page."
        onConfirm={() => navigate(-1)}
        actionText="Leave"
        closeText="Stay"
      >
        <TbArrowLeft size={20} />
      </ConfirmButton>
      <h1 class="text-lg font-semibold ml-2">New Recurring Transaction</h1>
    </header>
  );
};

const NewForm = () => {
  const navigate = useNavigate();

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
  const [recurrenceType, setRecurrenceType] =
    createSignal<RecurrenceType>("regular");
  const [recurrenceValue, setRecurrenceValue] = createSignal("");
  const isRecurrenceValueValid = createMemo(() =>
    validateOccurrence(recurrenceType(), recurrenceValue()),
  );

  const mutation = createMutation(() => ({
    mutationFn: async () => {
      return recurringTransactions.create({
        amount: amount(),
        start_date: new Date(startDate().toString()).getTime(),
        category: newCategory() || category(),
        description: description(),
        recurrence_type: recurrenceType(),
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
        <label class="text-sm font-medium">Start Date</label>
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
        <label class="text-sm font-medium">Category</label>
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

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">Recurrence Type</label>

        <Select
          options={recurrenceTypes}
          value={recurrenceType()}
          onChange={(value) => value && setRecurrenceType(value)}
          placeholder="Select a recurrence type"
          itemComponent={(props) => (
            <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
          )}
        >
          <SelectTrigger>
            <SelectValue<RecurrenceType>>
              {(state) => state.selectedOption()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
      </div>

      <Show when={recurrenceType() === "cron"}>
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
      </Show>

      <Show when={recurrenceType() === "regular"}>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">Recurrence Value</label>
          <Select
            options={recurrenceRegularValues}
            value={recurrenceValue()}
            onChange={(value) => value && setRecurrenceValue(String(value))}
            placeholder="Select a recurrence value"
            itemComponent={(props) => (
              <SelectItem item={props.item}>
                {IntervalToText[Number(props.item.rawValue)]}
              </SelectItem>
            )}
          >
            <SelectTrigger>
              <SelectValue<number>>
                {(state) => IntervalToText[Number(state.selectedOption())]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        </div>
      </Show>

      <Button
        type="submit"
        disabled={mutation.isPending || !isRecurrenceValueValid().ok}
      >
        {mutation.isPending ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
};
