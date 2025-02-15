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
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldErrorMessage,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
  NumberFieldLabel,
} from "@/components/ui/number-field";
import {
  TextField,
  TextFieldErrorMessage,
  TextFieldLabel,
  TextFieldRoot,
} from "@/components/ui/textfield";
import transactions from "@/db/transactions";
import {
  createTransactionQuery,
  invalidateTransactionQueries,
} from "@/query/transactions";
import { useCurrency } from "@/signals/setting";
import { useTransactionCategories } from "@/signals/transactions";
import { CalendarDate } from "@internationalized/date";
import { useNavigate, useParams } from "@solidjs/router";
import { createForm } from "@tanstack/solid-form";
import { createMutation } from "@tanstack/solid-query";
import { TbArrowLeft } from "solid-icons/tb";
import { createEffect, createMemo, createSignal, Index, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { z } from "zod";
import { NewTransactionForm } from "./new";

export const EditTransactionPage = () => {
  return (
    <main class="flex flex-col p-2 overflow-y-auto flex-grow">
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
        size={24}
        onClick={() => navigate(-1)}
      />
      <h1 class="text-lg font-semibold ml-2">Edit Transaction</h1>
    </header>
  );
};

const EditTransactionForm = () => {
  const params = useParams();
  const navigate = useNavigate();
  const categories = useTransactionCategories();
  const [isExpense, setIsExpense] = createSignal(true);
  const amountSign = createMemo(() => (isExpense() ? -1 : 1));
  const [currency] = useCurrency();

  const query = createTransactionQuery(() => Number(params.id));

  const mutation = createMutation(() => ({
    mutationFn: async (data: NewTransactionForm) => {
      if (!query.data) throw new Error("No transaction data");
      const valueWithSign = {
        ...query.data,
        ...data,
        amount: data.amount * amountSign(),
      };
      return transactions.update(valueWithSign);
    },
    onSuccess: () => {
      invalidateTransactionQueries();
      navigate("/");
      toastSuccess("Transaction updated successfully");
    },
    onError: (error: unknown) => {
      console.error("[UI] Error updating transaction", error);
      if (error instanceof Error) {
        toastError(error.message);
      } else {
        toastError("An unknown error occurred");
      }
    },
  }));

  createEffect(() => {
    if (query.data) {
      setIsExpense(query.data.amount < 0);
    }
  });

  const defaultValues = createMemo(() => {
    return {
      amount: Math.abs(query.data?.amount ?? 0),
      transaction_date: query.data?.transaction_date ?? Date.now(),
      description: query.data?.description ?? "",
      category: query.data?.category ?? "",
    };
  });

  const form = createForm<NewTransactionForm>(() => ({
    defaultValues: defaultValues(),
    onSubmit: async ({ value }) => {
      mutation.mutate(value);
    },
  }));

  return (
    <Show when={query.data} fallback={<div>Loading...</div>}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        class="flex flex-col gap-4"
      >
        <div class="w-full grid grid-cols-2 gap-2">
          <Button
            variant={isExpense() ? "default" : "outline"}
            onClick={() => setIsExpense(true)}
          >
            Expense
          </Button>
          <Button
            variant={isExpense() ? "outline" : "default"}
            onClick={() => setIsExpense(false)}
          >
            Income
          </Button>
        </div>

        <form.Field
          name="amount"
          validators={{
            onChange: z.coerce
              .number()
              .refine((value) => value !== 0, "Amount must be non-zero"),
          }}
          children={(field) => (
            <NumberField
              rawValue={field().state.value}
              onRawValueChange={field().handleChange}
              formatOptions={{ style: "currency", currency: currency() }}
              validationState={
                field().state.meta.errors.length ? "invalid" : "valid"
              }
            >
              <NumberFieldLabel>Amount</NumberFieldLabel>
              <NumberFieldGroup>
                <NumberFieldDecrementTrigger aria-label="Decrement" />
                <NumberFieldInput class="text-md" />
                <NumberFieldIncrementTrigger aria-label="Increment" />
              </NumberFieldGroup>
              <NumberFieldErrorMessage>
                {field().state.meta.errors[0]}
              </NumberFieldErrorMessage>
            </NumberField>
          )}
        />

        <form.Field
          name="transaction_date"
          children={(field) => {
            const date = createMemo(() => new Date(field().state.value));
            const calendarDate = createMemo(
              () =>
                new CalendarDate(
                  date().getFullYear(),
                  date().getMonth() + 1,
                  date().getDate(),
                ),
            );

            return (
              <div class="flex flex-col gap-1">
                <label class="font-medium">Date</label>
                <DatePicker
                  value={[calendarDate()]}
                  onValueChange={(change) => {
                    const date = change.value[0] as CalendarDate;
                    field().handleChange(new Date(date.toString()).getTime());
                  }}
                  locale="en"
                  positioning={{ placement: "bottom-start" }}
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
                                                  <DatePickerTableCell
                                                    value={day()}
                                                  >
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
            );
          }}
        />

        <form.Field
          name="description"
          children={(field) => (
            <TextFieldRoot>
              <TextFieldLabel>Description</TextFieldLabel>
              <TextField
                placeholder="Description"
                value={field().state.value || ""}
                onInput={(e) => field().handleChange(e.currentTarget.value)}
              />
            </TextFieldRoot>
          )}
        />

        <form.Field
          name="category"
          validators={{
            onChange: z.string().min(1, "Category is required"),
          }}
          children={(field) => (
            <TextFieldRoot
              validationState={
                field().state.meta.errors.length ? "invalid" : "valid"
              }
            >
              <TextFieldLabel>Category</TextFieldLabel>
              <Combobox
                onInputChange={field().handleChange}
                onChange={(value) => {
                  if (!value) return;
                  field().handleChange(value);
                }}
                options={categories()}
                placeholder="Select or enter category"
                disallowEmptySelection={false}
                itemComponent={(props) => (
                  <ComboboxItem {...props}>{props.item.rawValue}</ComboboxItem>
                )}
              >
                <ComboboxTrigger>
                  <ComboboxInput value={field().state.value} />
                </ComboboxTrigger>
                <ComboboxContent class="overflow-y-auto max-h-[200px]" />
              </Combobox>

              <TextFieldErrorMessage>
                {field().state.meta.errors[0]}
              </TextFieldErrorMessage>
            </TextFieldRoot>
          )}
        />

        <form.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
          children={(state) => (
            <Button
              type="submit"
              disabled={!state().canSubmit || state().isSubmitting}
            >
              {state().isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          )}
        />
      </form>
    </Show>
  );
};
