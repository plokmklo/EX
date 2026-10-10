'use client';

/**
 * Item details dialog (Dialog on desktop, Sheet drawer on mobile) with
 * Overview / Comments / Movements / Requests tabs.
 */
import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { itemsApi, ApiError } from '@/lib/ims-client';
import {
  CategoryBadge,
  EmptyState,
  fmtDate,
  fmtDateTime,
  ItemStatusBadge,
  MovementBadge,
  RequestStatusBadge,
  RoleBadge,
  StockMeter,
  usd,
  UserAvatar,
} from './shared';
import type { ItemDto, SafeUser } from '@/types/ims';

function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const fn = () => setMobile(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return mobile;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</p>
      <p className="mt-0.5 text-sm">{value ?? <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

function Overview({ item }: { item: ItemDto }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <ItemStatusBadge status={item.status} />
        <CategoryBadge name={item.category.name} />
        <Badge variant="outline" className="font-mono text-[11px]">{item.code}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Quantity" value={<span className="font-semibold tabular-nums">{item.quantity} {item.unit}</span>} />
        <Field label="Reserved" value={<span className="tabular-nums">{item.reservedQty}</span>} />
        <Field label="Available" value={<span className="tabular-nums">{item.availableQty}</span>} />
        <Field label="Unit price" value={<span className="tabular-nums">{usd(item.unitPrice)}</span>} />
        <Field label="Stock value" value={<span className="tabular-nums">{usd(item.unitPrice * item.quantity)}</span>} />
        <Field label="Min stock level" value={<span className="tabular-nums">{item.minStockLevel}</span>} />
        <Field label="Brand" value={item.brand} />
        <Field label="Model" value={item.model} />
        <Field label="Serial" value={<span className="font-mono text-xs">{item.serial}</span>} />
        <Field label="Location" value={item.location} />
        <Field label="Created" value={fmtDate(item.createdAt)} />
        <Field label="Updated" value={fmtDate(item.updatedAt)} />
      </div>
      <div>
        <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Stock health</p>
        <div className="mt-1.5 flex items-center gap-3">
          <StockMeter quantity={item.quantity} minStockLevel={item.minStockLevel} />
          <span className="text-muted-foreground text-xs tabular-nums">
            {item.quantity === 0
              ? 'Out of stock'
              : item.quantity <= item.minStockLevel
                ? 'Low — below reorder point'
                : 'Healthy'}
          </span>
        </div>
      </div>
      {item.description && (
        <div>
          <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Description</p>
          <p className="mt-1 text-sm leading-relaxed">{item.description}</p>
        </div>
      )}
    </div>
  );
}

function Comments({ itemId, user }: { itemId: string; user: SafeUser }) {
  const qc = useQueryClient();
  const [body, setBody] = React.useState('');
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['item', itemId],
    queryFn: () => itemsApi.detail(itemId),
  });

  const add = useMutation({
    mutationFn: () => itemsApi.addComment(itemId, body.trim()),
    onSuccess: () => {
      setBody('');
      toast.success('Comment added');
      qc.invalidateQueries({ queryKey: ['item', itemId] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to add comment'),
  });

  const comments = data?.comments ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          rows={2}
          placeholder={`Add a note as ${user.firstName}…`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={!body.trim() || add.isPending}
            onClick={() => add.mutate()}
          >
            Post comment
          </Button>
        </div>
      </div>
      <Separator />
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <EmptyState title="No comments yet" description="Notes help the team track condition, suppliers and quirks." />
      ) : (
        <ScrollArea className="max-h-56 pr-2">
          <ul className="space-y-3">
            {[...comments]
              .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
              .map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <UserAvatar firstName={c.user.firstName} lastName={c.user.lastName} className="size-7" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-semibold">
                        {c.user.firstName} {c.user.lastName}
                      </span>
                      <RoleBadge role={c.user.role} />
                      <span className="text-muted-foreground">{fmtDateTime(c.createdAt)}</span>
                    </p>
                    <p className="mt-0.5 text-sm leading-snug whitespace-pre-wrap">{c.body}</p>
                  </div>
                </li>
              ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}

function Movements({ itemId }: { itemId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['item', itemId], queryFn: () => itemsApi.detail(itemId) });
  const movements = data?.movements ?? [];
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (movements.length === 0)
    return <EmptyState title="No movements recorded" description="Stock changes (IN/OUT/ADJUST) will appear here." />;
  return (
    <div className="overflow-hidden rounded-lg border">
      <ScrollArea className="max-h-72">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>User</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements
              .slice()
              .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
              .map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <MovementBadge type={m.type} />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{m.quantity}</TableCell>
                  <TableCell className="text-muted-foreground max-w-40 truncate text-xs">{m.note ?? '—'}</TableCell>
                  <TableCell className="text-xs">{m.user ? `${m.user.firstName} ${m.user.lastName}` : 'System'}</TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">{fmtDateTime(m.createdAt)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

function Requests({ itemId }: { itemId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['item', itemId], queryFn: () => itemsApi.detail(itemId) });
  const requests = data?.requests ?? [];
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (requests.length === 0)
    return <EmptyState title="No requests for this item" description="Staff requests will show up here." />;
  return (
    <div className="overflow-hidden rounded-lg border">
      <ScrollArea className="max-h-72">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead>Qty</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests
              .slice()
              .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
              .slice(0, 20)
              .map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-semibold tabular-nums">
                    {r.quantity} {r.item.unit}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.requester.firstName} {r.requester.lastName}
                  </TableCell>
                  <TableCell>
                    <RequestStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">{fmtDateTime(r.createdAt)}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}

export function ItemDetailsDialog({
  itemId,
  open,
  onOpenChange,
  user,
}: {
  itemId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: SafeUser;
}) {
  const isMobile = useIsMobile();
  const { data, isLoading } = useQuery({
    queryKey: ['item', itemId],
    queryFn: () => itemsApi.detail(itemId!),
    enabled: open && !!itemId,
  });

  const item = data?.item;
  const title = item ? item.name : 'Item details';
  const subtitle = item ? `${item.code} · ${item.category.name}` : 'Loading…';

  const header = (
    <>
      <DialogHeader className={isMobile ? 'sr-only' : undefined}>
        <DialogTitle className="flex items-center gap-2">
          {title}
          {item && <ItemStatusBadge status={item.status} />}
        </DialogTitle>
        <DialogDescription>{subtitle}</DialogDescription>
      </DialogHeader>
      <SheetHeader className={isMobile ? undefined : 'sr-only'}>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{subtitle}</SheetDescription>
      </SheetHeader>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[92vh] px-4 pb-4">
          {header}
          {isLoading || !item ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <Tabs defaultValue="overview" className="mt-2 flex min-h-0 flex-1 flex-col">
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                <TabsTrigger value="comments" className="flex-1">Comments</TabsTrigger>
                <TabsTrigger value="movements" className="flex-1">Movements</TabsTrigger>
                <TabsTrigger value="requests" className="flex-1">Requests</TabsTrigger>
              </TabsList>
              <ScrollArea className="mt-4 min-h-0 flex-1 pr-1">
                <TabsContent value="overview"><Overview item={item} /></TabsContent>
                <TabsContent value="comments"><Comments itemId={itemId!} user={user} /></TabsContent>
                <TabsContent value="movements"><Movements itemId={itemId!} /></TabsContent>
                <TabsContent value="requests"><Requests itemId={itemId!} /></TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-3xl">
        {header}
        {isLoading || !item ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="overview" className="mt-2">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="comments">Comments ({data.comments.length})</TabsTrigger>
              <TabsTrigger value="movements">Movements ({data.movements.length})</TabsTrigger>
              <TabsTrigger value="requests">Requests ({data.requests.length})</TabsTrigger>
            </TabsList>
            <div className="max-h-[60vh] overflow-y-auto pt-4">
              <TabsContent value="overview"><Overview item={item} /></TabsContent>
              <TabsContent value="comments"><Comments itemId={itemId!} user={user} /></TabsContent>
              <TabsContent value="movements"><Movements itemId={itemId!} /></TabsContent>
              <TabsContent value="requests"><Requests itemId={itemId!} /></TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
