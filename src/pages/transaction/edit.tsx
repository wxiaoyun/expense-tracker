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
import {
  createTransactionCategoriesQuery,
  createTransactionQuery,
} from "@/query/transactions";
import { CalendarDate } from "@internationalized/date";
import { toaster } from "@kobalte/core";
import { useNavigate, useParams } from "@solidjs/router";
import { createMutation } from "@tanstack/solid-query";
import { TbArrowLeft } from "solid-icons/tb";
import { Index, Show, createEffect, createMemo, createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import { otherCategory } from "./new";

export const EditTransactionPage = () => {
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

    setAmount(query.data.amount);
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
        updated_at: new Date().getTime(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toaster.show((props) => (
        <Toast {...props}>
          <ToastContent>
            <ToastTitle>Success</ToastTitle>
            <ToastDescription>
              Transaction updated successfully
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

  return (
    <main class="flex flex-col p-4">
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
        <h1 class="text-lg font-semibold ml-2">Edit Transaction</h1>
      </header>

      <Show when={query.data} fallback={<div>Loading...</div>}>
        <form onSubmit={handleSubmit} class="flex flex-col gap-4">
          <TextFieldRoot>
            <TextField
              type="number"
              step="0.01"
              placeholder="Amount"
              value={Number(amount())}
              onChange={(e) =>
                setAmount(parseFloat(e.currentTarget.value) || 0)
              }
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

          <TextFieldRoot>
            <TextField
              placeholder="Description"
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
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
            required
          >
            <ComboboxTrigger>
              <ComboboxInput />
            </ComboboxTrigger>
            <ComboboxContent />
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
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </Show>
    </main>
  );
};
