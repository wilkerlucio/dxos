//
// Copyright 2023 DXOS.org
//

import { useControllableState } from '@radix-ui/react-use-controllable-state';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnSizingInfoState,
  type GroupingState,
  type RowData,
  type ColumnSizingState,
  type OnChangeFn,
  type RowSelectionState,
  getGroupedRowModel,
} from '@tanstack/react-table';
import { useVirtualizer, type VirtualizerOptions } from '@tanstack/react-virtual';
import React, { Fragment, useCallback, useEffect, useState } from 'react';

import { debounce } from '@dxos/async';

import { TableBody } from './TableBody';
import { TableProvider as UntypedTableProvider, type TypedTableProvider, useTableContext } from './TableContext';
import { TableFooter } from './TableFooter';
import { TableHead } from './TableHead';
import { type TableProps } from './props';
import { groupTh, tableRoot } from '../../theme';

export const Table = <TData extends RowData>(props: TableProps<TData>) => {
  const {
    role,
    data = [],
    columns = [],
    onColumnResize,
    columnVisibility,
    header = true,
    rowsSelectable,
    debug,
    onDataSelectionChange,
  } = props;

  const TableProvider = UntypedTableProvider as TypedTableProvider<TData>;

  //
  // Column resizing
  //

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  useEffect(() => {
    // Set initial state.
    setColumnSizing(
      columns
        .filter((column) => !!column.size && (column as any).prop !== undefined)
        .reduce<ColumnSizingState>((state, column) => {
          state[(column as any).prop] = column.size!;
          return state;
        }, {}),
    );
  }, [columns]);

  const [columnSizingInfo, setColumnSizingInfo] = useState<ColumnSizingInfoState>({} as ColumnSizingInfoState);
  const onColumnResizeDebounced = onColumnResize && debounce<ColumnSizingState>(onColumnResize, 1_000);
  useEffect(() => {
    if (columnSizingInfo.columnSizingStart?.length === 0) {
      onColumnResizeDebounced?.(table.getState().columnSizing);
    }
  }, [columnSizingInfo]);

  //
  // Row selection
  //

  const [rowSelection = {}, setRowSelection] = useControllableState({
    prop: props.rowSelection,
    onChange: props.onRowSelectionChange,
    defaultProp: props.defaultRowSelection,
  });

  useEffect(() => {
    onDataSelectionChange?.(Object.keys(rowSelection).map((id) => table.getRowModel().rowsById[id].original));
  }, [onDataSelectionChange, rowSelection]);

  // TODO(thure): Does @tanstack/react-table really need this intervention? It did seem necessary to enforce single-selection...
  const handleRowSelectionChange = useCallback<OnChangeFn<RowSelectionState>>(
    (updaterOrValue) => {
      const nextRowSelection = typeof updaterOrValue === 'function' ? updaterOrValue(rowSelection) : updaterOrValue;
      if (rowsSelectable === 'multi') {
        setRowSelection(nextRowSelection);
      } else if (rowsSelectable) {
        const nextRowSelectionKey = Object.keys(nextRowSelection).filter((id) => !rowSelection[id])[0];
        setRowSelection(nextRowSelectionKey ? { [nextRowSelectionKey]: true } : {});
      } else {
        setRowSelection({});
      }
    },
    [rowSelection, setRowSelection],
  );

  //
  // Row grouping
  //

  const [grouping, handleGroupingChange] = useState<GroupingState>(props.grouping ?? []);
  useEffect(() => handleGroupingChange(props.grouping ?? []), [props.grouping]);

  const table = useReactTable({
    // Data
    meta: {},
    data,

    // Columns
    columns,
    defaultColumn: {
      size: 256, // Required in order remove default width.
      maxSize: 1024,
    },

    // State
    state: {
      columnVisibility,
      columnSizing,
      columnSizingInfo,
      rowSelection,
      grouping,
    },

    // Resize columns
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    onColumnSizingChange: setColumnSizing,
    onColumnSizingInfoChange: setColumnSizingInfo,

    // Rows
    getCoreRowModel: getCoreRowModel(),

    // Grouping
    getGroupedRowModel: grouping.length > 1 ? getGroupedRowModel() : undefined,
    onGroupingChange: handleGroupingChange,

    // Selection
    ...(rowsSelectable === 'multi'
      ? { enableMultiRowSelection: true }
      : rowsSelectable
        ? { enableRowSelection: true }
        : {}),
    onRowSelectionChange: handleRowSelectionChange,

    // Debug
    debugTable: debug,
  });

  // Create additional expansion column if all columns have fixed width.
  const expand = false; // columns.map((column) => column.size).filter(Boolean).length === columns?.length;

  return (
    <TableProvider
      {...props}
      table={table}
      header={header}
      expand={expand}
      isGrid={role === 'grid' || role === 'treegrid'}
    >
      <TableImpl<TData> debug={false} />
    </TableProvider>
  );
};

/**
 * Pure implementation of table outside of context set-up.
 */
const TableImpl = <TData extends RowData>(props: TableProps<TData>) => {
  const { role, footer, grouping, getScrollElement, fullWidth, classNames, debug } = props;
  const { table } = useTableContext<TData>('TableImpl');
  const { rows } = table.getRowModel();

  if (debug) {
    return (
      <pre className='font-mono text-xs text-neutral-500 m-1 p-2 ring'>
        <code>{JSON.stringify(table.getState(), undefined, 2)}</code>
      </pre>
    );
  }

  return (
    <table
      role={role}
      className={tableRoot(props, classNames)}
      {...(!fullWidth && { style: { width: table.getTotalSize() } })}
    >
      <TableHead />

      {grouping?.length !== 0 ? (
        getScrollElement ? (
          <VirtualizedTableContent getScrollElement={getScrollElement} />
        ) : (
          <TableBody rows={rows} />
        )
      ) : (
        <GroupedTableContent />
      )}

      {footer && <TableFooter />}
    </table>
  );
};

const VirtualizedTableContent = ({
  getScrollElement,
}: Pick<VirtualizerOptions<Element, Element>, 'getScrollElement'>) => {
  const {
    table: { getRowModel },
  } = useTableContext('VirtualizedTableContent');
  const rows = getRowModel().rows;

  const { getTotalSize, getVirtualItems } = useVirtualizer({
    getScrollElement,
    count: rows.length,
    overscan: 16,
    estimateSize: () => 33,
  });
  const virtualRows = getVirtualItems();
  const totalSize = getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0) : 0;

  return (
    <>
      {paddingTop > 0 && (
        <tbody role='none'>
          <tr role='none'>
            <td style={{ height: `${paddingTop}px` }} role='none' />
          </tr>
        </tbody>
      )}
      <TableBody rows={virtualRows.map((virtualRow) => rows[virtualRow.index])} />
      {paddingBottom > 0 && (
        <tbody role='none'>
          <tr role='none'>
            <td style={{ height: `${paddingBottom}px` }} role='none' />
          </tr>
        </tbody>
      )}
    </>
  );
};

const GroupedTableContent = () => {
  const {
    table: { getGroupedRowModel, getHeaderGroups, getState },
    debug,
  } = useTableContext('GroupedTableContent');
  return (
    <>
      {getGroupedRowModel().rows.map((row, i) => {
        return (
          <Fragment key={i}>
            {/* TODO(burdon): Customize group header renderer. */}
            <thead>
              <tr>
                {debug && <th />}
                <th
                  // TODO(burdon): Calculate row span.
                  colSpan={getHeaderGroups()[0].headers.length}
                  className={groupTh({})}
                >
                  {getState().grouping[0]}[{String(row.getGroupingValue(getState().grouping[0]))}]
                </th>
              </tr>
            </thead>
            <TableBody rows={row.subRows} />
          </Fragment>
        );
      })}
    </>
  );
};
