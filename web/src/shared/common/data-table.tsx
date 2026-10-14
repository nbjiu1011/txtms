"use client";

import "react-data-table-component/css";
import RDataTable, { type PaginationComponentProps, type TableColumn } from "react-data-table-component";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/shared/lib";
import { Pager } from "./pager";

/** A column; `rowAction` columns hold their own buttons, so a click there does not open the row. */
export type DataTableColumn<T> = TableColumn<T> & {
  /** The cell holds its own control (button, link): clicks on it do not count as a row click. */
  rowAction?: boolean;
};

export interface DataTablePage {
  /** Zero-based page. */
  number: number;
  size: number;
  totalElements: number;
}

export interface DataTableProps<T> {
  /** Accessible name of the table. */
  label: string;
  columns: DataTableColumn<T>[];
  data: T[];
  /** Field with a unique value per row (default `id`). */
  keyField?: string;
  /** Row click (opens the detail). Give one column a {@link RowLink} so keyboard users reach it too. */
  onRowClick?: (row: T) => void;
  /** Server paging: the current page from the API; `onPage` gets the zero-based page to load. */
  page?: DataTablePage;
  onPage?: (page: number) => void;
  loading?: boolean;
  /** Shown instead of rows when there are none (default 표시할 항목이 없습니다). */
  empty?: ReactNode;
  className?: string;
}

/**
 * The list table of every screen (react-data-table-component, user decision 2026-10-14). Styled from the design
 * tokens through the library's `--rdt-*` variables; rows open their detail on click (pointer + highlight); paging is
 * done by the server (`page` / `onPage`, 20 rows) with numbered pages. No client sorting — the API orders lists.
 */
export function DataTable<T>({
  label,
  columns,
  data,
  keyField = "id",
  onRowClick,
  page,
  onPage,
  loading,
  empty,
  className,
}: DataTableProps<T>) {
  // The library counts a click as a row click only when the clicked element itself is the cell (it checks the
  // target's data-tag), so a click on a chip or a name inside a cell would do nothing. Plain cells therefore let
  // clicks through their content to the cell; `rowAction` cells keep their own buttons clickable instead.
  const cols = columns.map(({ rowAction, ...c }) => {
    if (rowAction) return { ...c, ignoreRowClick: true };
    const render = c.cell;
    if (!onRowClick || !render) return c;
    return {
      ...c,
      cell: (row: T, index: number, column: TableColumn<T>, id: string | number) => (
        <div className="pointer-events-none contents">{render(row, index, column, id)}</div>
      ),
    };
  });
  const paged = !!page && page.totalElements > page.size;
  return (
    <div className={cn("txtms-table", className)} style={TOKENS} aria-busy={loading || undefined}>
      <RDataTable<T>
        ariaLabel={label}
        columns={cols}
        data={data}
        keyField={keyField as keyof T & string}
        onRowClicked={onRowClick ? (row) => onRowClick(row) : undefined}
        pointerOnHover={!!onRowClick}
        highlightOnHover={!!onRowClick}
        progressPending={loading}
        progressComponent={<div className="px-3 py-8 text-center text-[13px] text-sub">불러오는 중…</div>}
        noDataComponent={empty ?? <div className="px-3 py-8 text-center text-[13px] text-sub">표시할 항목이 없습니다.</div>}
        persistTableHead
        headerSeparator={false}
        columnSeparator={false}
        responsive
        pagination={paged}
        paginationServer
        paginationTotalRows={page?.totalElements ?? 0}
        paginationPerPage={page?.size ?? 20}
        paginationPage={page ? page.number + 1 : 1}
        onChangePage={(p) => onPage?.(p - 1)}
        paginationComponent={TablePager}
      />
    </div>
  );
}

/** The app's pager (이전 · page numbers · 다음, `n / N`) in place of the library's. */
function TablePager({ rowsPerPage, rowCount, currentPage, onChangePage }: PaginationComponentProps) {
  return (
    <Pager
      page={currentPage - 1}
      totalPages={Math.ceil(rowCount / rowsPerPage)}
      onPage={(p) => onChangePage(p + 1, rowCount)}
    />
  );
}

/**
 * The cell text that opens the row, as a real button: keyboard and screen-reader users reach the detail through it
 * (react-data-table-component rows are not focusable). Put it in a `rowAction` column, so a click is not counted
 * twice.
 */
export function RowLink({ onClick, children, label }: { onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-ink hover:underline focus-visible:underline"
    >
      {children}
    </button>
  );
}

/** Library variables mapped to the design tokens. */
const TOKENS = {
  "--rdt-color-bg": "var(--surface)",
  "--rdt-color-header-bg": "var(--surface)",
  "--rdt-color-footer-bg": "var(--surface)",
  "--rdt-color-text-primary": "var(--ink)",
  "--rdt-color-text-secondary": "var(--sub)",
  "--rdt-color-divider": "var(--line)",
  "--rdt-color-highlight": "var(--indigo-soft)",
  "--rdt-color-highlight-text": "var(--ink)",
  "--rdt-color-primary": "var(--navy)",
  "--rdt-color-btn": "var(--sub)",
  "--rdt-color-btn-hover": "var(--sunk)",
  "--rdt-color-btn-focus": "var(--indigo-soft)",
  "--rdt-color-btn-disabled": "var(--line2)",
  "--rdt-font-family": "var(--font-sans)",
  "--rdt-font-size": "13px",
  "--rdt-font-size-header": "12px",
  "--rdt-row-height": "46px",
  "--rdt-header-height": "38px",
  "--rdt-cell-padding-x": "12px",
  "--rdt-border-radius": "0px",
} as CSSProperties;
