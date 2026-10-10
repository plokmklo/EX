'use client';

/**
 * Audit log (ADMIN/MANAGER): entity filter, search, colored action badges,
 * relative timestamps with absolute tooltips, expandable details, pagination.
 */
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  SearchIcon,
  RefreshCcwIcon,
  ScrollTextIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { auditApi } from '@/lib/ims-client';
import { AuditActionBadge, EmptyState, ErrorState, fmtDateTime, PaginationFooter, timeAgo, UserAvatar } from './shared';
import type { AuditDto } from '@/types/ims';

const ENTITIES = ['', 'Item', 'Request', 'User', 'Category', 'Auth', 'Comment', 'System'];

function entityLabel(entity: string): string {
  if (!entity) return 'All entities';
  return entity.charAt(0).toUpperCase() + entity.slice(1).toLowerCase();
}

export function AuditView() {
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [entity, setEntity] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(15);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['audit', { search, entity, page, pageSize }],
    queryFn: () =>
      auditApi.list({
        search: search || undefined,
        entity: entity || undefined,
        page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const showSkeleton = isLoading && !data;

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search actions, actors, details…"
              className="h-10 pl-9"
              aria-label="Search audit log"
            />
          </div>
          <div className="flex gap-2">
            <Select value={entity || 'all'} onValueChange={(v) => { setEntity(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="h-10 w-full sm:w-44" aria-label="Filter by entity">
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                {ENTITIES.map((e) => (
                  <SelectItem key={e || 'all'} value={e || 'all'}>
                    {e ? entityLabel(e) : 'All entities'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-10" onClick={() => refetch()} aria-label="Refresh audit log">
              <RefreshCcwIcon className={isRefetching ? 'size-3.5 animate-spin' : 'size-3.5'} /> Refresh
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {showSkeleton ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={error instanceof Error ? error.message : 'Failed to load audit log.'} onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ScrollTextIcon className="size-5" />}
            title="No audit entries"
            description="Actions are recorded here as users work with the system."
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <ul className="divide-y">
                {rows.map((a) => (
                  <AuditRow
                    key={a.id}
                    entry={a}
                    expanded={expanded === a.id}
                    onToggle={() => setExpanded((x) => (x === a.id ? null : a.id))}
                  />
                ))}
              </ul>
              <PaginationFooter
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
                pageSizeOptions={[15, 30, 50]}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </Card>
    </div>
  );
}

function AuditRow({ entry, expanded, onToggle }: { entry: AuditDto; expanded: boolean; onToggle: () => void }) {
  const hasDetails = !!entry.details;
  const nameParts = (entry.actorName ?? 'System').trim().split(' ');
  const firstName = nameParts[0] || null;
  const lastName = nameParts.slice(1).join(' ') || null;

  return (
    <li>
      <button
        type="button"
        onClick={hasDetails ? onToggle : undefined}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${hasDetails ? 'cursor-pointer hover:bg-accent/50' : 'cursor-default'} ${expanded ? 'bg-accent/30' : ''}`}
        aria-expanded={hasDetails ? expanded : undefined}
      >
        <UserAvatar firstName={firstName} lastName={lastName} className="size-8 shrink-0 text-[10px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold">{entry.actorName ?? 'System'}</span>
            <AuditActionBadge action={entry.action} />
            <Badge variant="outline" className="max-w-44 truncate font-mono text-[10px]">
              {entry.entity}
              {entry.entityId ? `#${entry.entityId.slice(0, 8)}` : ''}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {expanded && entry.details ? entry.details : entry.details || 'No additional details'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground text-xs whitespace-nowrap">{timeAgo(entry.createdAt)}</span>
            </TooltipTrigger>
            <TooltipContent>{fmtDateTime(entry.createdAt)}</TooltipContent>
          </Tooltip>
          {hasDetails ? (
            expanded ? (
              <ChevronDownIcon className="text-muted-foreground size-4" />
            ) : (
              <ChevronRightIcon className="text-muted-foreground size-4" />
            )
          ) : null}
        </div>
      </button>
    </li>
  );
}
