/**
 * Data display components - Tables, grids, pagination, state indicators
 */

'use client';

import React from 'react';
import type { TableColumn, TableRow } from '../../types/admin';

/**
 * DataTable - Flexible table component with pagination, sorting, filtering
 */
interface DataTableProps<T extends TableRow = TableRow> {
  columns: TableColumn<T>[];
  rows: T[];
  loading?: boolean;
  error?: string;
  onRowClick?: (row: T) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  selectable?: boolean;
  onSelectionChange?: (selectedIds: Set<string>) => void;
}

export function DataTable<T extends TableRow = any>({
  columns,
  rows,
  loading = false,
  error,
  onRowClick,
  onSort,
  sortBy,
  sortDirection,
  selectable = false,
  onSelectionChange,
}: DataTableProps<T>) {
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    onSelectionChange?.(selectedRows);
  }, [selectedRows, onSelectionChange]);

  if (error) {
    return (
      <div
        style={{
          padding: 'var(--space-lg)',
          textAlign: 'center',
          color: 'var(--color-error)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--color-error-light)',
        }}
        role="alert"
      >
        <p>{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
        <div className="spinner" style={{ display: 'inline-block' }} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-3xl)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
        }}
      >
        <p>No results found</p>
      </div>
    );
  }

  return (
    <table className="admin-table">
      <thead>
        <tr>
          {selectable && (
            <th style={{ width: '40px' }}>
              <input
                type="checkbox"
                checked={selectedRows.size === rows.length && rows.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedRows(new Set(rows.map((r) => r.id)));
                  } else {
                    setSelectedRows(new Set());
                  }
                }}
                aria-label="Select all rows"
              />
            </th>
          )}
          {columns.map((column) => (
            <th
              key={String(column.key)}
              style={{
                width: column.width,
                cursor: column.sortable ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (column.sortable && onSort) {
                  const newDirection =
                    sortBy === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
                  onSort(String(column.key), newDirection);
                }
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                {column.label}
                {column.sortable && sortBy === column.key && (
                  <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onRowClick?.(row)}
            style={{ cursor: onRowClick ? 'pointer' : 'default' }}
          >
            {selectable && (
              <td>
                <input
                  type="checkbox"
                  checked={selectedRows.has(row.id)}
                  onChange={(e) => {
                    const newSelected = new Set(selectedRows);
                    if (e.target.checked) {
                      newSelected.add(row.id);
                    } else {
                      newSelected.delete(row.id);
                    }
                    setSelectedRows(newSelected);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select row ${row.id}`}
                />
              </td>
            )}
            {columns.map((column) => (
              <td key={String(column.key)}>
                {column.render
                  ? column.render(row[column.key], row)
                  : String(row[column.key] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * PaginationControls - Navigation for paginated data
 */
interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-lg)',
        borderTop: '1px solid var(--color-border)',
        flexWrap: 'wrap',
        gap: 'var(--space-md)',
      }}
    >
      <div style={{ fontSize: 'var(--text-body-sm)', color: 'var(--color-text-secondary)' }}>
        Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
      </div>

      {onPageSizeChange && (
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          <label htmlFor="page-size" style={{ fontSize: 'var(--text-body-sm)' }}>
            Per page:
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="form-control"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button
          className="btn btn-sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
        >
          ← Previous
        </button>

        <div
          style={{
            display: 'flex',
            gap: 'var(--space-xs)',
            alignItems: 'center',
          }}
        >
          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            const pageNum = i + 1;
            return (
              <button
                key={pageNum}
                className={pageNum === page ? 'btn btn-sm btn-primary' : 'btn btn-sm'}
                onClick={() => onPageChange(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          className="btn btn-sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

/**
 * LoadingState - Skeleton loader
 */
export function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            height: '40px',
            borderRadius: 'var(--radius-md)',
          }}
        />
      ))}
    </div>
  );
}

/**
 * ErrorState - Error display with retry
 */
interface ErrorStateProps {
  title: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div
      style={{
        padding: 'var(--space-2xl)',
        textAlign: 'center',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-error-light)',
        border: '1px solid var(--color-error)',
      }}
      role="alert"
    >
      <h3 style={{ color: 'var(--color-error)', margin: '0 0 var(--space-md) 0' }}>⚠️ {title}</h3>
      {message && (
        <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 var(--space-lg) 0' }}>
          {message}
        </p>
      )}
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}

/**
 * EmptyState - Empty data display
 */
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: string;
}

export function EmptyState({ title, description, action, icon = '📭' }: EmptyStateProps) {
  return (
    <div
      style={{
        padding: 'var(--space-3xl)',
        textAlign: 'center',
        color: 'var(--color-text-secondary)',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>{icon}</div>
      <h3 style={{ color: 'var(--color-text)', marginBottom: 'var(--space-md)' }}>{title}</h3>
      {description && <p style={{ marginBottom: 'var(--space-lg)' }}>{description}</p>}
      {action && (
        <button className="btn btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
