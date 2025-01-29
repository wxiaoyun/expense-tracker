import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/libs/cn";
import { formatCurrency } from "@/libs/currency";
import { createTransactionSummarizeByCategoryQuery } from "@/query/transactions";
import { useDateRange } from "@/signals/params";
import { useCurrency } from "@/signals/setting";
import {
  createColumnHelper,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
} from "@tanstack/solid-table";
import {
  FaSolidBars,
  FaSolidChevronDown,
  FaSolidChevronUp,
} from "solid-icons/fa";
import { Component, createMemo, createSignal, For, Show } from "solid-js";

type SummaryRow = {
  category: string;
  expense?: number;
  income?: number;
  balance?: number;
};

const ColoredCurrency = (props: { value?: number }) => {
  const [currency] = useCurrency();
  return (
    <Show
      when={props.value}
      fallback={<span class="text-muted-foreground">-</span>}
    >
      <span class={cn(props.value! < 0 ? "text-red-500" : "text-green-500")}>
        {formatCurrency(Math.abs(props.value!), { currency: currency() })}
      </span>
    </Show>
  );
};

const columnHelper = createColumnHelper<SummaryRow>();

const columns = [
  columnHelper.accessor("category", {
    header: "Category",
    enableSorting: true,
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("expense", {
    header: "Expense",
    enableSorting: true,
    sortingFn: "alphanumeric",
    sortUndefined: "last",
    cell: (info) => <ColoredCurrency value={info.getValue()} />,
  }),
  columnHelper.accessor("income", {
    header: "Income",
    enableSorting: true,
    sortingFn: "alphanumeric",
    sortUndefined: "last",
    cell: (info) => <ColoredCurrency value={info.getValue()} />,
  }),
  columnHelper.accessor("balance", {
    header: "Balance",
    enableSorting: true,
    sortingFn: "alphanumeric",
    sortUndefined: "last",
    cell: (info) => <ColoredCurrency value={info.getValue()} />,
  }),
];

export const SummaryTable: Component = () => {
  const { dateRange } = useDateRange();
  const query = createTransactionSummarizeByCategoryQuery(dateRange);

  const data = createMemo(() => {
    if (!query.data) return [];

    // Change 0 to undefined to push the row to the bottom when sorting
    return query.data.map((item) => ({
      category: item.category,
      expense: item.expense || undefined,
      income: item.income || undefined,
      balance: item.balance || undefined,
    }));
  });

  const [sorting, setSorting] = createSignal<SortingState>([]);

  const table = createSolidTable({
    columns,
    get data() {
      console.log(data());
      return data();
    },
    state: {
      get sorting() {
        return sorting();
      },
    },
    enableSorting: true,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div class="overflow-x-auto border-t">
      <Table class="w-full">
        <TableHeader>
          <For each={table.getHeaderGroups()}>
            {(headerGroup) => (
              <TableRow>
                <For each={headerGroup.headers}>
                  {(header) => (
                    <TableHead
                      class={cn(
                        header.column.getCanSort() &&
                          "cursor-pointer select-none",
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div class="flex items-center gap-2">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        {header.column.getCanSort() &&
                          {
                            asc: <FaSolidChevronUp />,
                            desc: <FaSolidChevronDown />,
                            false: <FaSolidBars class="opacity-50" size={14} />,
                          }[(header.column.getIsSorted() as string) ?? "false"]}
                      </div>
                    </TableHead>
                  )}
                </For>
              </TableRow>
            )}
          </For>
        </TableHeader>
        <TableBody>
          <For each={table.getRowModel().rows}>
            {(row) => (
              <TableRow>
                <For each={row.getVisibleCells()}>
                  {(cell) => (
                    <TableCell>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  )}
                </For>
              </TableRow>
            )}
          </For>
        </TableBody>
      </Table>
    </div>
  );
};
