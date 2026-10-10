'use client';

/**
 * Requests view: status summary chips, tabbed list (mine vs all), workflow
 * actions (approve / reject / issue / return / cancel) with confirm dialogs.
 */
import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  CheckIcon,
  XIcon,
  PackageCheckIcon,
  Undo2Icon,
  BanIcon,
  ClipboardListIcon,
  RefreshCcwIcon,
  ClockIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requestsApi, ApiError } from '@/lib/ims-client';
import {
  EmptyState,
  ErrorState,
  fmtDateTime,
  PaginationFooter,
  RequestStatusBadge,
  timeAgo,
  UserAvatar,
} from './shared';
import type { RequestDto, RequestStatus, SafeUser } from '@/types/ims';

const STATUSES: RequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'ISSUED', 'RETURNED', 'CANCELLED'];

const CHIP_CLS: Record<RequestStatus, string> = {
  PENDING: 'data-[on=true]:bg-amber-500/15 data-[on=true]:text-amber-700 dark:data-[on=true]:text-amber-400 data-[on=true]:border-amber-500/40',
  APPROVED: 'data-[on=true]:bg-emerald-500/15 data-[on=true]:text-emerald-700 dark:data-[on=true]:text-emerald-400 data-[on=true]:border-emerald-500/40',
  REJECTED: 'data-[on=true]:bg-rose-500/15 data-[on=true]:text-rose-700 dark:data-[on=true]:text-rose-400 data-[on=true]:border-rose-500/40',
  ISSUED: 'data-[on=true]:bg-violet-500/15 data-[on=true]:text-violet-700 dark:data-[on=true]:text-violet-400 data-[on=true]:border-violet-500/40',
  RETURNED: 'data-[on=true]:bg-teal-500/15 data-[on=true]:text-teal-700 dark:data-[on=true]:text-teal-400 data-[on=true]:border-teal-500/40',
  CANCELLED: 'data-[on=true]:bg-zinc-500/15 data-[on=true]:text-zinc-700 dark:data-[on=true]:text-zinc-400 data-[on=true]:border-zinc-500/40',
};

type ActionKind = 'approve' | 'reject' | 'issue' | 'return' | 'cancel';

export function RequestsView({ user }: { user: SafeUser }) {
  const qc = useQueryClient();
  const isStaff = user.role === 'STAFF';
  const canDecide = user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'STOREKEEPER';
  const canIssue = user.role === 'ADMIN' || user.role === 'STOREKEEPER';

  const [scope, setScope] = React.useState<'mine' | 'all'>(isStaff ? 'mine' : 'all');
  const [status, setStatus] = React.useState<RequestStatus | ''>('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  // Summary: pageSize=200 latest for chips count
  const { data: summary } = useQuery({
    queryKey: ['requests', 'summary'],
    queryFn: () => requestsApi.list({ pageSize: 200, page: 1 }),
    staleTime: 20_000,
  });

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['requests', scope, status, page, pageSize, isStaff],
    queryFn: () => {
      if (isStaff || scope === 'mine') return requestsApi.list({ status: status || undefined, page, pageSize, mine: !isStaff || undefined });
      return requestsApi.list({ status: status || undefined, page, pageSize });
    },
    placeholderData: (prev) => prev,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['requests'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    qc.invalidateQueries({ queryKey: ['items'] });
    qc.invalidateQueries({ queryKey: ['audit'] });
  };

  const act = useMutation({
    mutationFn: ({ id, kind, note }: { id: string; kind: ActionKind; note?: string }) => requestsApi.act(id, kind, note),
    onSuccess: (res, vars) => {
      const msg: Record<ActionKind, string> = {
        approve: 'Request approved',
        reject: 'Request rejected',
        issue: `${res.request.quantity} ${res.request.item.unit} issued`,
        return: 'Items marked as returned — stock restocked',
        cancel: 'Request cancelled',
      };
      toast.success(msg[vars.kind], {
        description: `${res.request.item.name} · ${res.request.requester.firstName} ${res.request.requester.lastName}`,
      });
      invalidate();
    },
    onError: (err, vars) =>
      toast.error('Action failed', {
        description: err instanceof ApiError ? err.message : `Could not ${vars.kind} the request.`,
      }),
  });

  // Dialog state
  const [rejectTarget, setRejectTarget] = React.useState<RequestDto | null>(null);
  const [rejectNote, setRejectNote] = React.useState('');
  const [issueTarget, setIssueTarget] = React.useState<RequestDto | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<RequestDto | null>(null);

  const requests = data?.data ?? [];
  const total = data?.total ?? 0;

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUSES) counts[s] = 0;
    for (const r of summary?.data ?? []) if (counts[r.status] !== undefined) counts[r.status] += 1;
    counts[''] = summary?.total ?? 0;
    return counts;
  }, [summary]);

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-on={status === ''}
          onClick={() => {
            setStatus('');
            setPage(1);
          }}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent ${status === '' ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-600/40' : 'bg-background'}`}
        >
          All <span className="tabular-nums">({statusCounts['']})</span>
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            data-on={status === s}
            onClick={() => {
              setStatus(status === s ? '' : s);
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent ${CHIP_CLS[s]} ${status === s ? '' : 'bg-background'}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()} <span className="tabular-nums">({statusCounts[s]})</span>
          </button>
        ))}
        <Button variant="outline" size="sm" className="ml-auto h-9" onClick={() => refetch()} aria-label="Refresh requests">
          <RefreshCcwIcon className={isRefetching ? 'size-3.5 animate-spin' : 'size-3.5'} /> Refresh
        </Button>
      </div>

      {!isStaff && (
        <Tabs value={scope} onValueChange={(v) => { setScope(v as 'mine' | 'all'); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="all">All requests</TabsTrigger>
            <TabsTrigger value="mine">Requested by me</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <Card className="overflow-hidden p-0">
        {isLoading && !data ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={error instanceof Error ? error.message : 'Failed to load requests.'} onRetry={() => refetch()} />
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<ClipboardListIcon className="size-5" />}
            title={status ? `No ${status.toLowerCase()} requests` : 'No requests yet'}
            description={
              isStaff
                ? 'Browse the inventory and use “Request stock” to submit your first request.'
                : scope === 'mine'
                  ? 'You have not submitted any requests. Use “Request stock” from the Inventory page.'
                  : 'Requests submitted by staff will appear here for review.'
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${page}-${status}-${scope}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {/* Desktop table */}
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Date</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      {!isStaff && <TableHead>Requester</TableHead>}
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r) => (
                      <RequestRow
                        key={r.id}
                        r={r}
                        user={user}
                        isStaff={isStaff}
                        canDecide={canDecide}
                        canIssue={canIssue}
                        onApprove={() => act.mutate({ id: r.id, kind: 'approve' })}
                        onReject={() => {
                          setRejectTarget(r);
                          setRejectNote('');
                        }}
                        onIssue={() => setIssueTarget(r)}
                        onReturn={() => act.mutate({ id: r.id, kind: 'return' })}
                        onCancel={() => setCancelTarget(r)}
                        pending={act.isPending}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y lg:hidden">
                {requests.map((r) => (
                  <RequestCard
                    key={r.id}
                    r={r}
                    user={user}
                    isStaff={isStaff}
                    canDecide={canDecide}
                    canIssue={canIssue}
                    onApprove={() => act.mutate({ id: r.id, kind: 'approve' })}
                    onReject={() => {
                      setRejectTarget(r);
                      setRejectNote('');
                    }}
                    onIssue={() => setIssueTarget(r)}
                    onReturn={() => act.mutate({ id: r.id, kind: 'return' })}
                    onCancel={() => setCancelTarget(r)}
                    pending={act.isPending}
                  />
                ))}
              </div>

              <PaginationFooter
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </Card>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>
              {rejectTarget
                ? `${rejectTarget.requester.firstName} requested ${rejectTarget.quantity} × ${rejectTarget.item.name}. A note is shared with the requester.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="Reason for rejection (e.g. insufficient budget, wrong item)…"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            className="resize-none"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Keep pending
            </Button>
            <Button
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={act.isPending}
              onClick={() => {
                if (rejectTarget) {
                  act.mutate({ id: rejectTarget.id, kind: 'reject', note: rejectNote.trim() || undefined });
                  setRejectTarget(null);
                }
              }}
            >
              <XIcon className="size-4" /> Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue confirm */}
      <AlertDialog open={!!issueTarget} onOpenChange={(o) => !o && setIssueTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hand over stock?</AlertDialogTitle>
            <AlertDialogDescription>
              Issuing will decrement {issueTarget?.quantity} {issueTarget?.item.unit} of{' '}
              <strong>{issueTarget?.item.name}</strong> and record an OUT movement for custody.{' '}
              {issueTarget && `Currently ${issueTarget.item.availableQty} available.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              className="bg-violet-600 text-white hover:bg-violet-700"
              disabled={act.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (issueTarget) {
                  act.mutate({ id: issueTarget.id, kind: 'issue' });
                  setIssueTarget(null);
                }
              }}
            >
              <PackageCheckIcon className="size-4" /> Issue stock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirm */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              Your pending request for {cancelTarget?.quantity} × {cancelTarget?.item.name} will be withdrawn. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep request</AlertDialogCancel>
            <AlertDialogAction
              disabled={act.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (cancelTarget) {
                  act.mutate({ id: cancelTarget.id, kind: 'cancel' });
                  setCancelTarget(null);
                }
              }}
            >
              <BanIcon className="size-4" /> Cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* --------------------------- Row / Card --------------------------- */

interface RowProps {
  r: RequestDto;
  user: SafeUser;
  isStaff: boolean;
  canDecide: boolean;
  canIssue: boolean;
  onApprove: () => void;
  onReject: () => void;
  onIssue: () => void;
  onReturn: () => void;
  onCancel: () => void;
  pending: boolean;
}

function ActionButtons({ r, user, canDecide, canIssue, onApprove, onReject, onIssue, onReturn, onCancel, pending }: RowProps) {
  const isMine = r.requester.id === user.id;
  return (
    <div className="flex justify-end gap-1.5">
      {r.status === 'PENDING' && canDecide && (
        <>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                className="h-8 bg-emerald-600 px-2.5 text-white hover:bg-emerald-700"
                disabled={pending}
                onClick={onApprove}
              >
                <CheckIcon className="size-3.5" /> Approve
              </Button>
            </TooltipTrigger>
            <TooltipContent>Approve this request</TooltipContent>
          </Tooltip>
          <Button size="sm" variant="outline" className="h-8 border-rose-500/40 px-2.5 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400" disabled={pending} onClick={onReject}>
            <XIcon className="size-3.5" /> Reject
          </Button>
        </>
      )}
      {r.status === 'PENDING' && isMine && !canDecide && (
        <Button size="sm" variant="outline" className="h-8" disabled={pending} onClick={onCancel}>
          <BanIcon className="size-3.5" /> Cancel
        </Button>
      )}
      {r.status === 'APPROVED' && canIssue && (
        <Button size="sm" className="h-8 bg-violet-600 px-2.5 text-white hover:bg-violet-700" disabled={pending} onClick={onIssue}>
          <PackageCheckIcon className="size-3.5" /> Issue
        </Button>
      )}
      {r.status === 'APPROVED' && isMine && !canIssue && (
        <Button size="sm" variant="outline" className="h-8" disabled={pending} onClick={onCancel}>
          <BanIcon className="size-3.5" /> Cancel
        </Button>
      )}
      {r.status === 'ISSUED' && canIssue && (
        <Button size="sm" className="h-8 bg-teal-600 px-2.5 text-white hover:bg-teal-700" disabled={pending} onClick={onReturn}>
          <Undo2Icon className="size-3.5" /> Mark returned
        </Button>
      )}
    </div>
  );
}

function RequestRow(p: RowProps) {
  const { r, isStaff } = p;
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        <p className="text-xs">{timeAgo(r.createdAt)}</p>
        <p className="text-muted-foreground text-[11px]">{fmtDateTime(r.createdAt)}</p>
      </TableCell>
      <TableCell>
        <div className="max-w-48">
          <p className="truncate text-sm font-medium">{r.item.name}</p>
          <p className="text-muted-foreground font-mono text-xs">{r.item.code}</p>
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">
        {r.quantity} <span className="text-muted-foreground text-xs">{r.item.unit}</span>
      </TableCell>
      {!isStaff && (
        <TableCell>
          <div className="flex items-center gap-2">
            <UserAvatar firstName={r.requester.firstName} lastName={r.requester.lastName} className="size-7 text-[10px]" />
            <span className="text-xs whitespace-nowrap">
              {r.requester.firstName} {r.requester.lastName}
            </span>
          </div>
        </TableCell>
      )}
      <TableCell>
        {r.reason ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground block max-w-40 cursor-help truncate text-xs">{r.reason}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-60">{r.reason}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        <RequestStatusBadge status={r.status} />
      </TableCell>
      <TableCell>
        {r.decisionNote ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground block max-w-36 cursor-help truncate text-xs">
                {r.reviewer ? `${r.reviewer.firstName}: ` : ''}
                {r.decisionNote}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-60">
              {r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}: ` : ''}
              {r.decisionNote}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell>
        <ActionButtons {...p} />
      </TableCell>
    </TableRow>
  );
}

function RequestCard(p: RowProps) {
  const { r, isStaff } = p;
  return (
    <div className="space-y-2.5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{r.item.name}</p>
          <p className="text-muted-foreground truncate font-mono text-xs">{r.item.code}</p>
        </div>
        <RequestStatusBadge status={r.status} />
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="font-semibold tabular-nums">
          {r.quantity} {r.item.unit}
        </span>
        <span className="text-muted-foreground flex items-center gap-1">
          <ClockIcon className="size-3" /> {timeAgo(r.createdAt)}
        </span>
        {!isStaff && (
          <span className="text-muted-foreground ml-auto">
            {r.requester.firstName} {r.requester.lastName}
          </span>
        )}
      </div>
      {r.reason && <p className="text-muted-foreground line-clamp-2 text-xs italic">“{r.reason}”</p>}
      {r.decisionNote && (
        <p className="text-muted-foreground text-xs">
          <Badge variant="outline" className="mr-1 text-[10px]">
            Note
          </Badge>
          {r.decisionNote}
        </p>
      )}
      <div className="pt-1">
        <ActionButtons {...p} />
      </div>
    </div>
  );
}
