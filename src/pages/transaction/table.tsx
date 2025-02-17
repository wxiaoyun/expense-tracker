import { toastError } from "@/components/toast";
import { Checkbox, CheckboxControl } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import transactions, { Transaction } from "@/db/transactions";
import { cn } from "@/libs/cn";
import { formatCurrency } from "@/libs/currency";
import { confirmationCallback } from "@/libs/dialog";
import { invalidateTransactionQueries } from "@/query/transactions";
import {
  useDateRange,
  useSearchTransactionParams,
  useTransactionCategoryParams,
  useVerifiedTransactionParams,
  VerifiedTransactionParams,
} from "@/signals/params";
import { useCurrency } from "@/signals/setting";
import { useInfiniteTransactions } from "@/signals/transactions";
import { useNavigate } from "@solidjs/router";
import { rankItem } from "@tanstack/match-sorter-utils";
import { createMutation } from "@tanstack/solid-query";
import {
  CellContext,
  createColumnHelper,
  createSolidTable,
  FilterMeta,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  Row,
  SortingState,
} from "@tanstack/solid-table";
import { createVirtualizer } from "@tanstack/solid-virtual";
import {
  FaSolidBars,
  FaSolidCheck,
  FaSolidChevronDown,
  FaSolidChevronUp,
  FaSolidPen,
  FaSolidTrash,
  FaSolidXmark,
} from "solid-icons/fa";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onMount,
  Switch,
} from "solid-js";

const AmountCell = (props: CellContext<Transaction, unknown>) => {
  const [currency] = useCurrency();
  const isIncome = () => props.row.original.amount > 0;
  const formattedAmount = () =>
    formatCurrency(props.row.original.amount, {
      currency: currency(),
    });

  return (
    <div
      class={cn(
        "whitespace-nowrap",
        isIncome() ? "text-green-600" : "text-red-600",
      )}
    >
      {formattedAmount()}
    </div>
  );
};

const ActionCell = (props: CellContext<Transaction, unknown>) => {
  const navigate = useNavigate();

  const deleteMutation = createMutation(() => ({
    mutationFn: async () => {
      await transactions.delete(props.row.original.id);
    },
    onSuccess: () => {
      invalidateTransactionQueries();
    },
    onError: (error: unknown) => {
      console.error("[UI] Error deleting transaction", error);
      if (error instanceof Error) {
        toastError(error.message);
      } else {
        toastError("An unknown error occurred");
      }
    },
  }));

  const handleDelete = confirmationCallback(
    "This action will delete the transaction.",
    {
      title: "Are you sure?",
      okLabel: "Delete",
      cancelLabel: "Cancel",
      onConfirm: deleteMutation.mutate,
    },
  );

  return (
    <div class="flex gap-2">
      <FaSolidPen
        class="text-blue-500 hover:text-blue-600 cursor-pointer transition-colors"
        size={20}
        onClick={() => navigate(`/transactions/edit/${props.row.original.id}`)}
      />
      <FaSolidTrash
        class="text-red-500 hover:text-red-600 cursor-pointer transition-colors"
        size={20}
        onClick={handleDelete}
      />
    </div>
  );
};

const VerificationCell = (props: CellContext<Transaction, unknown>) => {
  const verified = () => props.row.original.verified === 1;
  const toggleVerified = createMutation(() => ({
    mutationFn: async (verified: boolean) => {
      await transactions.setVerification(
        props.row.original.id,
        verified ? 1 : 0,
      );
    },
    onSuccess: () => {
      invalidateTransactionQueries();
    },
    onError: (error: unknown) => {
      console.error("[UI] Error setting transaction verification", error);
      if (error instanceof Error) {
        toastError(error.message);
      } else {
        toastError("An unknown error occurred");
      }
    },
  }));

  return (
    <Checkbox
      class="flex items-center space-x-2"
      checked={verified()}
      onChange={toggleVerified.mutate}
    >
      <CheckboxControl />
    </Checkbox>
  );
};

const VerificationHeader = () => {
  const [verified, setVerified] = useVerifiedTransactionParams();
  const options = ["All", "Verified", "Unverified"];
  let idx = 0;

  const cycleVerified = () => {
    idx = (idx + 1) % options.length;
    setVerified(options[idx] as VerifiedTransactionParams);
  };

  return (
    <div class="flex justify-center items-center gap-2" onClick={cycleVerified}>
      <span>Verified</span>

      <Switch>
        <Match when={verified() === "All"}>
          <FaSolidBars class="opacity-50" size={14} />
        </Match>
        <Match when={verified() === "Verified"}>
          <FaSolidCheck class="text-green-500" size={14} />
        </Match>
        <Match when={verified() === "Unverified"}>
          <FaSolidXmark class="text-red-500" size={14} />
        </Match>
      </Switch>
    </div>
  );
};

const columnHelper = createColumnHelper<Transaction>();

const columns = [
  columnHelper.accessor("transaction_date", {
    header: "Date",
    size: 80,
    enableGlobalFilter: true,
    cell: (props) => (
      <span>
        {new Date(props.row.original.transaction_date).toLocaleDateString()}
      </span>
    ),
  }),
  columnHelper.accessor("category", {
    header: "Category",
    size: 100,
    enableGlobalFilter: true,
    cell: (props) => <span>{props.row.original.category}</span>,
  }),
  columnHelper.accessor("description", {
    header: "Description",
    enableGlobalFilter: true,
    cell: (props) => <span>{props.row.original.description || "-"}</span>,
  }),
  columnHelper.accessor("amount", {
    header: "Amount",
    size: 100,
    cell: AmountCell,
  }),
  columnHelper.accessor("verified", {
    header: VerificationHeader,
    enableSorting: false,
    size: 100,
    cell: VerificationCell,
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    enableSorting: false,
    size: 60,
    cell: ActionCell,
  }),
];

const fuzzyFilter = (
  row: Row<Transaction>,
  columnId: string,
  filterValue: string,
  addMeta: (meta: FilterMeta) => void,
) => {
  const itemRank = rankItem(row.getValue(columnId), filterValue);
  addMeta(itemRank);
  return itemRank.passed;
};

export const TransactionTable = () => {
  const [sorting, setSorting] = createSignal<SortingState>([]);
  const { dateRange } = useDateRange();
  const [globalFilter, setGlobalFilter] = useSearchTransactionParams();
  const [selectedCategories] = useTransactionCategoryParams();
  const [verified] = useVerifiedTransactionParams();

  const verifiedNum = createMemo(() => {
    if (verified() === "All") {
      return undefined;
    }
    return verified() === "Verified" ? 1 : 0;
  });

  const queryParam = createMemo(() => {
    const srt = sorting();
    const firstSorting = srt.length > 0 ? srt[0] : null;
    const orderBy = !firstSorting
      ? ["transaction_date", "DESC"]
      : [firstSorting.id, firstSorting.desc ? "DESC" : "ASC"];
    return {
      start: dateRange().start,
      end: dateRange().end,
      limit: 50,
      categories: selectedCategories(),
      orderBy: orderBy as [keyof Transaction, "ASC" | "DESC"],
      verified: verifiedNum(),
    };
  });

  //eslint-disable-next-line
  const query = useInfiniteTransactions(queryParam);
  const allTransactions = createMemo(() => {
    return query.data?.pages.flatMap((page) => page.items) ?? [];
  });

  const table = createSolidTable({
    defaultColumn: {
      // @ts-expect-error Workaround for achieve auto resizing
      size: "auto",
    },
    columns,
    get data() {
      return allTransactions();
    },
    state: {
      get sorting() {
        return sorting();
      },
      get globalFilter() {
        return globalFilter();
      },
    },
    enableSorting: true,
    manualSorting: true, // server side sorting
    onSortingChange: setSorting,
    enableGlobalFilter: true,
    globalFilterFn: fuzzyFilter,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const headerGroups = table.getHeaderGroups;
  const rowModel = table.getRowModel;

  let el!: HTMLDivElement;
  const virtualizer = createVirtualizer({
    get count() {
      return rowModel().rows.length;
    },
    getScrollElement: () => el,
    estimateSize: () => 36,
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: 10,
  });

  const fetchMoreTransactionOnPageEnd = (target: HTMLDivElement) => {
    const scrollHeight = target.scrollHeight;
    const scrollTop = target.scrollTop;
    const clientHeight = target.clientHeight;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    const isFetching = query.isFetchingNextPage;
    const hasNextPage = query.hasNextPage;

    if (distanceToBottom < 500 && !isFetching && hasNextPage) {
      query.fetchNextPage();
    }
  };

  onMount(() => {
    fetchMoreTransactionOnPageEnd(el);
  });

  return (
    <div
      ref={el}
      class="w-full h-full overflow-auto"
      onScroll={(e) => fetchMoreTransactionOnPageEnd(e.currentTarget)}
    >
      <Table class="relative">
        <TableHeader class="sticky top-0 z-10 w-full bg-background">
          <For each={headerGroups()}>
            {(headerGroup) => (
              <TableRow class="flex items-center w-full">
                <For each={headerGroup.headers}>
                  {(header) =>
                    header.isPlaceholder ? null : (
                      <TableHead
                        colSpan={header.colSpan}
                        style={{
                          width: header.getSize()
                            ? `${header.getSize()}px`
                            : "auto",
                          flex: header.getSize() ? "0 0 auto" : "1",
                        }}
                        class={cn(
                          "flex items-center",
                          header.column.getCanSort() &&
                            "cursor-pointer select-none",
                          header.column.id === "description" && "min-w-[200px]",
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div class="flex items-center gap-2">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {header.column.getCanSort() &&
                            {
                              asc: <FaSolidChevronUp />,
                              desc: <FaSolidChevronDown />,
                              false: (
                                <FaSolidBars class="opacity-50" size={14} />
                              ),
                            }[
                              (header.column.getIsSorted() as string) ?? "false"
                            ]}
                        </div>
                      </TableHead>
                    )
                  }
                </For>
              </TableRow>
            )}
          </For>
        </TableHeader>
        <TableBody
          class="relative block w-full"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          <For each={virtualizer.getVirtualItems()}>
            {(item) => {
              let tr!: HTMLTableRowElement;
              const row = () => rowModel().rows[item.index];

              // Workaround: manually access signals such that Solidjs tracks them as dependency and re-run the effect
              createEffect(() => {
                //eslint-disable-next-line
                item.size;
                virtualizer.measureElement(tr);
              });

              return (
                <TableRow
                  ref={tr}
                  class="flex w-full absolute top-0 left-0"
                  data-index={item.index}
                  style={{
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <For each={row()?.getVisibleCells() ?? []}>
                    {(cell) => (
                      <TableCell
                        colSpan={cell.column.getSize()}
                        style={{
                          width: cell.column.getSize()
                            ? `${cell.column.getSize()}px`
                            : "auto",
                          flex: cell.column.getSize() ? "0 0 auto" : "1",
                        }}
                        class={cn(
                          "flex items-center",
                          cell.column.id === "description" && "min-w-[200px]",
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    )}
                  </For>
                </TableRow>
              );
            }}
          </For>
        </TableBody>
      </Table>
    </div>
  );
};
