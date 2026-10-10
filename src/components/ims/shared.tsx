'use client';

/**
 * Shared EX-IMS presentational helpers: badges, KPI card, empty/error states,
 * pagination footer, avatar initials, formatters.
 */
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  InboxIcon,
  AlertCircleIcon,
  RefreshCcwIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ItemStatus, RequestStatus, Role, UserStatus, MovementType } from '@/types/ims';

/* ----------------------------- Formatters ----------------------------- */

export const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);

export const num = (n: number) => new Intl.NumberFormat('en-US').format(n ?? 0);

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(1, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function initials(first?: string | null, last?: string | null): string {
  const a = (first ?? '').trim().charAt(0);
  const b = (last ?? '').trim().charAt(0);
  return ((a || '?') + (b || '')).toUpperCase();
}

export function prettyLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ----------------------------- Badges ----------------------------- */

const STATUS_BADGE: Record<ItemStatus, string> = {
  AVAILABLE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  OUT_OF_STOCK: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  MAINTENANCE: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  DISCONTINUED: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30',
};

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return (
    <Badge variant="outline" className={STATUS_BADGE[status] ?? ''}>
      {prettyLabel(status)}
    </Badge>
  );
}

const REQ_BADGE: Record<RequestStatus, string> = {
  PENDING: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  APPROVED: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  REJECTED: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  ISSUED: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
  RETURNED: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
  CANCELLED: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30',
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge variant="outline" className={REQ_BADGE[status] ?? ''}>
      {prettyLabel(status)}
    </Badge>
  );
}

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  MANAGER: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
  STOREKEEPER: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  STAFF: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30',
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STOREKEEPER: 'Storekeeper',
  STAFF: 'Staff',
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant="outline" className={ROLE_BADGE[role] ?? ''}>
      {ROLE_LABEL[role] ?? role}
    </Badge>
  );
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge
      variant="outline"
      className={
        status === 'ACTIVE'
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
          : 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30'
      }
    >
      {prettyLabel(status)}
    </Badge>
  );
}

const MOVEMENT_BADGE: Record<MovementType, string> = {
  IN: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  OUT: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  ADJUST: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
};

export function MovementBadge({ type }: { type: MovementType }) {
  return (
    <Badge variant="outline" className={MOVEMENT_BADGE[type] ?? ''}>
      {type}
    </Badge>
  );
}

export function AuditActionBadge({ action }: { action: string }) {
  const prefix = action.split('_')[0]?.toUpperCase() ?? '';
  const cls =
    prefix === 'CREATE' || prefix === 'APPROVE' || prefix === 'SEED'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
      : prefix === 'DELETE' || prefix === 'REJECT'
        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
        : prefix === 'UPDATE'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
          : prefix === 'ISSUE'
            ? 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30'
            : prefix === 'RETURN'
              ? 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30'
              : 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30';
  return (
    <Badge variant="outline" className={cn('font-mono text-[11px]', cls)}>
      {action}
    </Badge>
  );
}

export function CategoryBadge({ name }: { name: string }) {
  return (
    <Badge variant="outline" className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/25 max-w-40 truncate">
      {name}
    </Badge>
  );
}

/* ----------------------------- Stock meter ----------------------------- */

export function StockMeter({ quantity, minStockLevel }: { quantity: number; minStockLevel: number }) {
  const pct = Math.min(100, Math.round((quantity / Math.max(1, minStockLevel * 3)) * 100));
  const color =
    quantity === 0 ? 'bg-rose-500' : quantity <= minStockLevel ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ----------------------------- Avatar ----------------------------- */

export function UserAvatar({
  firstName,
  lastName,
  className,
}: {
  firstName?: string | null;
  lastName?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-600/25',
        className,
      )}
      aria-hidden
    >
      {initials(firstName, lastName)}
    </div>
  );
}

/* ----------------------------- KPI card ----------------------------- */

export function KpiCard({
  label,
  value,
  icon,
  tone = 'default',
  hint,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'default' | 'amber' | 'rose' | 'emerald' | 'violet';
  hint?: string;
  loading?: boolean;
}) {
  const toneCls =
    tone === 'amber'
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
      : tone === 'rose'
        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
        : tone === 'emerald'
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : tone === 'violet'
            ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
            : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300';
  return (
    <div className="bg-card rounded-xl border p-4 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-xs font-medium">{label}</p>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-16" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          )}
          {hint && !loading && <p className="text-muted-foreground mt-0.5 text-[11px]">{hint}</p>}
        </div>
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', toneCls)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Empty / error / loading ----------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
        {icon ?? <InboxIcon className="size-5" />}
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="text-muted-foreground max-w-sm text-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
        <AlertCircleIcon className="size-5" />
      </div>
      <p className="text-sm font-semibold">Something went wrong</p>
      <p className="text-muted-foreground max-w-sm text-xs">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          <RefreshCcwIcon className="size-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-6 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Pagination ----------------------------- */

export function PaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (s: number) => void;
  pageSizeOptions?: number[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
      <p className="text-muted-foreground text-xs tabular-nums">
        {total === 0 ? 'No records' : `Showing ${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(page * pageSize, total)} of ${num(total)}`}
        {onPageSizeChange && total > 0 && <span className="mx-1">·</span>}
      </p>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border-input bg-background h-8 rounded-md border px-2 text-xs tabular-nums"
          >
            {pageSizeOptions.map((o) => (
              <option key={o} value={o}>
                {o} / page
              </option>
            ))}
          </select>
        )}
        <span className="text-muted-foreground text-xs tabular-nums">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
