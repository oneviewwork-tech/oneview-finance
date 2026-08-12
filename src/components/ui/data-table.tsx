"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  className?: string;
  render: (row: T) => React.ReactNode;
  /** Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
}

const PAGE_SIZE = 20;

/** Production-grade table shell: search, sortable headers, pagination, row hover, empty state — reused across every operational list. */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  searchPlaceholder,
  searchText,
  emptyState,
  onRowClick,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  searchPlaceholder?: string;
  /** Extracts the searchable text for a row; omit to disable search. */
  searchText?: (row: T) => string;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query || !searchText) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => searchText(r).toLowerCase().includes(q));
  }, [rows, query, searchText]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(col: DataTableColumn<T>) {
    if (!col.sortValue) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
    setPage(0);
  }

  return (
    <div>
      {searchText && (
        <div className="relative mb-3 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder ?? "Search…"}
            className="h-8 pl-8 text-[0.8125rem]"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-table">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "select-none whitespace-nowrap px-3 py-2 font-medium",
                    col.align === "right" && "text-right",
                    col.sortValue && "cursor-pointer hover:text-foreground"
                  )}
                  onClick={() => toggleSort(col)}
                >
                  <span className={cn("inline-flex items-center gap-1", col.align === "right" && "flex-row-reverse")}>
                    {col.header}
                    {col.sortValue &&
                      (sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {pageRows.map((row) => (
              <tr
                key={getRowKey(row)}
                className={cn("transition-ui hover:bg-accent/50", onRowClick && "cursor-pointer")}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-3 py-2.5", col.align === "right" && "text-right", col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10">
                  {emptyState ?? <p className="text-center text-metadata">No results.</p>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-between text-metadata">
          <span>
            {sorted.length} record{sorted.length === 1 ? "" : "s"} · page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md border border-border px-2 py-1 transition-ui hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-md border border-border px-2 py-1 transition-ui hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
