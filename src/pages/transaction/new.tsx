import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { TextField, TextFieldRoot } from "@/components/ui/textfield";
import {
  Toast,
  ToastContent,
  ToastDescription,
  ToastProgress,
  ToastTitle,
} from "@/components/ui/toast";
import transactions from "@/db/transactions";
import { queryClient } from "@/query/query";
import { createTransactionCategoriesQuery } from "@/query/transactions";
import { useTransactionParams } from "@/signals/transaction-form";
import { CalendarDate } from "@internationalized/date";
import { toaster } from "@kobalte/core";
import { useNavigate } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { TbArrowLeft } from "solid-icons/tb";
import { Index, createMemo, createSignal } from "solid-js";
import { Portal } from "solid-js/web";

export const otherCategory = "Other";

export const NewTransactionPage = () => {
  return (
    <main class="flex flex-col p-2">
      <Header />
      <TransactionForm />
    </main>
  );
};

const Header = () => {
  const navigate = useNavigate();
  return (
    <header class="flex items-center mb-4">
      <AlertDialog>
        <AlertDialogTrigger as={Button} variant="ghost">
          <TbArrowLeft size={20} />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes will be lost if you leave this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="default" onClick={() => navigate(-1)}>
              Leave
            </Button>
            <AlertDialogClose class="m-0">Stay</AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <h1 class="text-lg font-semibold ml-2">New Transaction</h1>
    </header>
  );
};

const TransactionForm = () => {
  const navigate = useNavigate();
  // Allow search params to prefill the fields.
  const form = useTransactionParams("new_");

  const [amount, setAmount] = createSignal(parseFloat(form.amount()) || 0);
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
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toaster.show((props) => (
        <Toast {...props}>
          <ToastContent>
            <ToastTitle>Success</ToastTitle>
            <ToastDescription>
              Transaction created successfully
            </ToastDescription>
          </ToastContent>
          <ToastProgress />
        </Toast>
      ));
      navigate("/transactions");
    },
    onError: (error) => {
      toaster.show((props) => (
        <Toast {...props} variant="destructive">
          <ToastContent>
            <ToastTitle>Error</ToastTitle>
            <ToastDescription>{error.message}</ToastDescription>
          </ToastContent>
          <ToastProgress />
        </Toast>
      ));
    },
  }));

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    mutation.mutate();
  };

  const categoriesQuery = createTransactionCategoriesQuery();
  const categories = createMemo(() => {
    const categories = (categoriesQuery.data ?? []).map(
      (category) => category.category,
    );
    categories.push(otherCategory);
    return categories;
  });

  return (
    <form onSubmit={handleSubmit} class="flex flex-col gap-4">
      <TextFieldRoot>
        <TextField
          type="number"
          step="0.01"
          placeholder="Amount"
          value={Number(amount())}
          onChange={(e) => setAmount(parseFloat(e.currentTarget.value) || 0)}
          required
        />
      </TextFieldRoot>

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
                                    <DatePickerTableCell value={month().value}>
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

      <TextFieldRoot>
        <TextField
          placeholder="Description"
          value={description()}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
      </TextFieldRoot>

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
        disallowEmptySelection={false}
        required
      >
        <ComboboxTrigger>
          <ComboboxInput />
        </ComboboxTrigger>
        <ComboboxContent class="overflow-y-auto max-h-[200px]" />
      </Combobox>

      <TextFieldRoot>
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
        {mutation.isPending ? "Creating..." : "Create Transaction"}
      </Button>
    </form>
  );
};
