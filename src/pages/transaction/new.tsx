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
import transactions from "@/db/transactions";
import { queryClient } from "@/query/query";
import { TRANSACTIONS_QUERY_KEY } from "@/query/transactions";
import {
  useTransactionCategories,
  useTransactionParams,
} from "@/signals/transactions";
import { CalendarDate } from "@internationalized/date";
import { useNavigate } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { TbArrowLeft } from "solid-icons/tb";
import { createMemo, createSignal, Index, Show } from "solid-js";
import { Portal } from "solid-js/web";

export const NewTransactionPage = () => {
  return (
    <main class="flex flex-col p-2 overflow-y-auto flex-grow">
      <Header />
      <TransactionForm />
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
      <h1 class="text-lg font-semibold ml-2">New Transaction</h1>
    </header>
  );
};

const TransactionForm = () => {
  const navigate = useNavigate();
  // Allow search params to prefill the fields.
  const form = useTransactionParams("new_");
  const categories = useTransactionCategories();

  const [amount, setAmount] = createSignal(form.amount());
  const [date, setDate] = createSignal(
    (() => {
      const date = form.date();
      return new CalendarDate(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
    })(),
  );
  const [description, setDescription] = createSignal(form.description());
  const [category, setCategory] = createSignal(form.category());
  const [newCategory, setNewCategory] = createSignal("");

  const isAmountValid = createMemo(() => {
    const amt = Number(amount());
    return !isNaN(amt) && isFinite(amt) && amt !== 0;
  });
  const isCategoryValid = createMemo(() => {
    return category() || newCategory();
  });
  const isAllFieldsValid = createMemo(() => {
    return isAmountValid() && isCategoryValid();
  });

  const mutation = createMutation(() => ({
    mutationFn: async () => {
      return transactions.create({
        amount: Number(amount()),
        transaction_date: new Date(date().toString()).getTime(),
        description: description(),
        category: newCategory() || category(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
      toastSuccess("Transaction created successfully");
      navigate("/transactions");
    },
    onError: (error) => {
      console.error("[UI] Error creating transaction", error);
      toastError(error.message);
    },
  }));

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!isAllFieldsValid()) return;
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
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
            Please enter a valid amount
          </TextFieldErrorMessage>
        </Show>
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
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
      </TextFieldRoot>

      <div class="flex flex-col gap-1">
        <label class="font-medium">Category</label>
        <Combobox
          value={category()}
          onChange={(value) => {
            if (!value) return;
            setCategory(value);
            setNewCategory("");
          }}
          options={categories()}
          placeholder="Select or enter category"
          itemComponent={(props) => (
            <ComboboxItem {...props}>{props.item.rawValue}</ComboboxItem>
          )}
          disallowEmptySelection={false}
        >
          <ComboboxTrigger>
            <ComboboxInput value={category()} />
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
            Please enter a valid category
          </TextFieldErrorMessage>
        </Show>
      </TextFieldRoot>

      <Button
        type="submit"
        disabled={mutation.isPending || !isAllFieldsValid()}
      >
        {mutation.isPending ? "Creating..." : "Create Transaction"}
      </Button>
    </form>
  );
};
