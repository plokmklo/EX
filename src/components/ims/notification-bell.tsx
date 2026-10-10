'use client';

/**
 * EX-IMS notification center — derived alert feed (pending requests, low/out of
 * stock, own request updates) in a header popover with unread persistence.
 */
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BellIcon,
  ClipboardListIcon,
  AlertTriangleIcon,
  PackageXIcon,
  CheckCheckIcon,
  ArrowRightIcon,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { notificationsApi, type NotificationDto } from '@/lib/ims-client';
import { timeAgo } from './shared';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'ex-ims-dismissed-notifications';

function loadDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function persistDismissed(ids: string[]) {
  try {
    // keep the list bounded
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* storage unavailable */
  }
}

const TYPE_STYLE: Record<NotificationDto['type'], { icon: React.ElementType; cls: string }> = {
  REQUEST_PENDING: { icon: ClipboardListIcon, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  REQUEST_UPDATE: { icon: ClipboardListIcon, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  LOW_STOCK: { icon: AlertTriangleIcon, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  OUT_OF_STOCK: { icon: PackageXIcon, cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
};

export function NotificationBell({
  onNavigate,
}: {
  onNavigate: (view: 'requests' | 'inventory') => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState<string[]>([]);

  React.useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 60_000, // poll for fresh alerts every minute
    staleTime: 30_000,
    retry: 1,
  });

  const notifications = data?.data ?? [];
  const visible = notifications.filter((n) => !dismissed.includes(n.id));
  const unread = visible.length;

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    persistDismissed(next);
  };

  const dismissAll = () => {
    const next = [...dismissed, ...visible.map((n) => n.id)];
    setDismissed(next);
    persistDismissed(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        >
          <BellIcon className="size-4" />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white tabular-nums"
              aria-hidden
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-4 animate-ping rounded-full bg-rose-500/40" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0 sm:w-96">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <Badge className="h-5 rounded-full bg-emerald-600 px-1.5 text-[10px] text-white tabular-nums">
                {unread} new
              </Badge>
            )}
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={dismissAll}>
              <CheckCheckIcon className="size-3.5" /> Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="bg-muted size-8 shrink-0 animate-pulse rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <div className="bg-muted h-3 w-3/4 animate-pulse rounded" />
                    <div className="bg-muted h-2.5 w-1/2 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCheckIcon className="size-5" />
              </div>
              <p className="text-sm font-semibold">You&apos;re all caught up</p>
              <p className="text-muted-foreground text-xs">
                Stock alerts and request updates will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {visible.map((n) => {
                const style = TYPE_STYLE[n.type];
                return (
                  <li key={n.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        dismiss(n.id);
                        onNavigate(n.targetView);
                        setOpen(false);
                      }}
                      className="hover:bg-accent/60 flex w-full items-start gap-3 px-4 py-3 text-left transition-colors outline-none focus-visible:bg-accent/60"
                    >
                      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', style.cls)}>
                        <style.icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold">{n.title}</span>
                          <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                            {timeAgo(n.createdAt)}
                          </span>
                        </span>
                        <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs">{n.body}</span>
                      </span>
                      <ArrowRightIcon className="text-muted-foreground/0 group-hover:text-muted-foreground/70 mt-1 size-3.5 shrink-0 transition-colors" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Dismiss notification"
                      className="text-muted-foreground/50 hover:text-foreground absolute top-2 right-2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(n.id);
                      }}
                    >
                      <span className="text-sm leading-none">×</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
