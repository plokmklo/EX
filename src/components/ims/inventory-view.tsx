'use client';

/**
 * Inventory view: searchable/filterable/sortable item table with stock meters,
 * add/edit dialogs, details dialog, request-stock dialog, CSV export, delete.
 */
import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import {
  SearchIcon,
  PlusIcon,
  RefreshCcwIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  EyeIcon,
  PencilIcon,
  ClipboardCopyIcon,
  Trash2Icon,
  PackageOpenIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { categoriesApi, itemsApi, ApiError } from '@/lib/ims-client';
import { useImsStore } from '@/lib/ims-store';
import {
  CategoryBadge,
  EmptyState,
  ErrorState,
  fmtDate,
  ItemStatusBadge,
  PaginationFooter,
  StockMeter,
  usd,
} from './shared';
import { ItemFormDialog } from './item-form-dialog';
import { ItemDetailsDialog } from './item-details-dialog';
import { RequestStockDialog } from './request-stock-dialog';
import type { ItemDto, ItemStatus, SafeUser } from '@/types/ims';

const STATUSES: ItemStatus[] = ['AVAILABLE', 'OUT_OF_STOCK', 'MAINTENANCE', 'DISCONTINUED'];

interface Filters {
  search: string;
  categoryId: string;
  status: string;
  lowStock: boolean;
  sort: string;
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  categoryId: '',
  status: '',
  lowStock: false,
  sort: 'name',
  order: 'asc',
  page: 1,
  pageSize: 10,
};

export function InventoryView({ user }: { user: SafeUser }) {
  const qc = useQueryClient();
  const canManage = user.role === 'ADMIN' || user.role === 'STOREKEEPER';
  const canDelete = user.role === 'ADMIN';

  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  // Consume a search handed off from the ⌘K command palette / notifications
  const storeSearch = useImsStore((s) => s.inventorySearch);
  const consumeInventorySearch = useImsStore((s) => s.consumeInventorySearch);
  React.useEffect(() => {
    if (!storeSearch) return;
    const term = consumeInventorySearch();
    if (term) {
      setFilters((f) => ({ ...f, search: term, page: 1 }));
    }
  }, [storeSearch, consumeInventorySearch]);

  // debounce search input
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(filters.search);
      if (filters.search !== debouncedSearch) setFilters((f) => ({ ...f, page: 1 }));
    }, 350);
    return () => clearTimeout(t);
  }, [filters.search]);

  const queryFilters = {
    search: debouncedSearch || undefined,
    categoryId: filters.categoryId || undefined,
    status: (filters.status || undefined) as ItemStatus | undefined,
    lowStock: filters.lowStock,
    page: filters.page,
    pageSize: filters.pageSize,
    sort: filters.sort as 'name' | 'quantity' | 'unitPrice' | 'createdAt',
    order: filters.order,
  };

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['items', queryFilters],
    queryFn: () => itemsApi.list(queryFilters),
    placeholderData: (prev) => prev,
  });

  const { data: cats } = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });

  // Dialog state
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ItemDto | null>(null);
  const [detailsId, setDetailsId] = React.useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [requestItem, setRequestItem] = React.useState<ItemDto | null>(null);
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<ItemDto | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => itemsApi.remove(id),
    onSuccess: () => {
      toast.success('Item deleted', { description: `${deleting?.name ?? 'Item'} was removed from the catalogue (soft delete).` });
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (err) =>
      toast.error('Delete failed', {
        description: err instanceof ApiError ? err.message : 'Unexpected error — try again.',
      }),
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const showSkeleton = isLoading && !data;

  const patchFilters = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));

  const openDetails = (id: string) => {
    setDetailsId(id);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <Input
              value={filters.search}
              onChange={(e) => patchFilters({ search: e.target.value })}
              placeholder="Search name, code, brand or serial…"
              className="h-10 pl-9"
              aria-label="Search items"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:w-auto lg:shrink-0">
            <Select
              value={filters.categoryId || 'all'}
              onValueChange={(v) => patchFilters({ categoryId: v === 'all' ? '' : v, page: 1 })}
            >
              <SelectTrigger className="w-full lg:w-40" aria-label="Filter by category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(cats?.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status || 'all'}
              onValueChange={(v) => patchFilters({ status: v === 'all' ? '' : v, page: 1 })}
            >
              <SelectTrigger className="w-full lg:w-40" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={`${filters.sort}:${filters.order}`}
              onValueChange={(v) => {
                const [sort, order] = v.split(':');
                patchFilters({ sort, order: order as 'asc' | 'desc', page: 1 });
              }}
            >
              <SelectTrigger className="w-full lg:w-44" aria-label="Sort items">
                <SlidersHorizontalIcon className="size-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name:asc">Name A→Z</SelectItem>
                <SelectItem value="name:desc">Name Z→A</SelectItem>
                <SelectItem value="quantity:desc">Quantity high→low</SelectItem>
                <SelectItem value="quantity:asc">Quantity low→high</SelectItem>
                <SelectItem value="unitPrice:desc">Price high→low</SelectItem>
                <SelectItem value="createdAt:desc">Newest first</SelectItem>
              </SelectContent>
            </Select>
            <div className="border-input flex h-10 items-center justify-center gap-2 rounded-md border px-3">
              <Switch
                id="low-stock-only"
                checked={filters.lowStock}
                onCheckedChange={(v) => patchFilters({ lowStock: v, page: 1 })}
                className="data-[state=checked]:bg-emerald-600"
              />
              <Label htmlFor="low-stock-only" className="text-xs whitespace-nowrap">
                Low stock
              </Label>
            </div>
          </div>
        </div>

        <Separator className="my-3" />

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground mr-auto text-xs tabular-nums">
            {showSkeleton ? 'Loading…' : `${total} item${total === 1 ? '' : 's'} found`}
            {isRefetching && ' · refreshing…'}
          </p>
          <Button variant="outline" size="sm" className="h-9" onClick={() => refetch()} aria-label="Refresh list">
            <RefreshCcwIcon className={isRefetching ? 'size-3.5 animate-spin' : 'size-3.5'} /> Refresh
          </Button>
          {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
            <Button variant="outline" size="sm" className="h-9" asChild>
              <a href="/api/reports/export?type=inventory" aria-label="Export inventory CSV">
                <DownloadIcon className="size-3.5" /> Export CSV
              </a>
            </Button>
          )}
          {canManage && (
            <Button
              size="sm"
              className="h-9 bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <PlusIcon className="size-4" /> Add item
            </Button>
          )}
        </div>
      </Card>

      {/* Table card */}
      <Card className="overflow-hidden p-0">
        {showSkeleton ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            message={error instanceof Error ? error.message : 'Failed to load items.'}
            onRetry={() => refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<PackageOpenIcon className="size-5" />}
            title="No items match your filters"
            description={
              filters.search || filters.categoryId || filters.status || filters.lowStock
                ? 'Try clearing the search or filters to see more results.'
                : 'The catalogue is empty — add your first item to get started.'
            }
            action={
              canManage ? (
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <PlusIcon className="size-4" /> Add item
                </Button>
              ) : undefined
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${filters.page}-${filters.sort}-${filters.order}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="w-10" aria-label="Actions" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer"
                        onClick={() => openDetails(item.id)}
                      >
                        <TableCell>
                          <div className="max-w-56">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="text-muted-foreground truncate text-xs">
                              <span className="font-mono">{item.code}</span>
                              {item.brand ? ` · ${item.brand}` : ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <CategoryBadge name={item.category.name} />
                        </TableCell>
                        <TableCell>
                          <ItemStatusBadge status={item.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-semibold tabular-nums">{item.quantity}</span>
                              <span className="text-muted-foreground text-xs">{item.unit}</span>
                              {item.reservedQty > 0 && (
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <span className="ml-1 cursor-help text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                      res. {item.reservedQty}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {item.reservedQty} reserved in approved requests · {item.availableQty} available
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <StockMeter quantity={item.quantity} minStockLevel={item.minStockLevel} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{usd(item.unitPrice)}</TableCell>
                        <TableCell className="text-muted-foreground max-w-32 truncate text-xs">{item.location ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{fmtDate(item.updatedAt)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <RowActions
                            item={item}
                            user={user}
                            onView={() => openDetails(item.id)}
                            onEdit={() => {
                              setEditing(item);
                              setFormOpen(true);
                            }}
                            onRequest={() => {
                              setRequestItem(item);
                              setRequestOpen(true);
                            }}
                            onDelete={() => setDeleting(item)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y md:hidden">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="min-h-11 cursor-pointer p-4 active:bg-accent"
                    onClick={() => openDetails(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && openDetails(item.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        <p className="text-muted-foreground truncate font-mono text-xs">
                          {item.code}
                          {item.brand ? ` · ${item.brand}` : ''}
                        </p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          item={item}
                          user={user}
                          onView={() => openDetails(item.id)}
                          onEdit={() => {
                            setEditing(item);
                            setFormOpen(true);
                          }}
                          onRequest={() => {
                            setRequestItem(item);
                            setRequestOpen(true);
                          }}
                          onDelete={() => setDeleting(item)}
                        />
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <ItemStatusBadge status={item.status} />
                      <CategoryBadge name={item.category.name} />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-bold tabular-nums">{item.quantity}</span>
                        <span className="text-muted-foreground text-xs">{item.unit}</span>
                      </div>
                      <StockMeter quantity={item.quantity} minStockLevel={item.minStockLevel} />
                      <span className="text-muted-foreground ml-auto text-sm tabular-nums">{usd(item.unitPrice)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <PaginationFooter
                page={filters.page}
                pageSize={filters.pageSize}
                total={total}
                onPageChange={(p) => patchFilters({ page: p })}
                onPageSizeChange={(s) => patchFilters({ pageSize: s, page: 1 })}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </Card>

      {/* Dialogs */}
      <ItemFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} canManage={canManage} />
      <ItemDetailsDialog itemId={detailsId} open={detailsOpen} onOpenChange={setDetailsOpen} user={user} />
      <RequestStockDialog item={requestItem} open={requestOpen} onOpenChange={setRequestOpen} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This performs a soft delete — the item is removed from the catalogue but its movement history is
              preserved. This action is audited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleting) remove.mutate(deleting.id);
              }}
            >
              {remove.isPending ? 'Deleting…' : 'Delete item'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActions({
  item,
  user,
  onView,
  onEdit,
  onRequest,
  onDelete,
}: {
  item: ItemDto;
  user: SafeUser;
  onView: () => void;
  onEdit: () => void;
  onRequest: () => void;
  onDelete: () => void;
}) {
  const canManage = user.role === 'ADMIN' || user.role === 'STOREKEEPER';
  const canDelete = user.role === 'ADMIN';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${item.name}`}>
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onView}>
          <EyeIcon className="size-4" /> View details
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon className="size-4" /> Edit
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onRequest}>
          <ClipboardCopyIcon className="size-4" /> Request stock
        </DropdownMenuItem>
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon className="size-4" /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
