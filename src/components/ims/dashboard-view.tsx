'use client';

/**
 * Dashboard: KPI cards, stock movement area chart, category pie, reorder
 * suggestions (reorder-point), top-requested horizontal bars, activity feed.
 */
import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  PackageIcon,
  BoxesIcon,
  AlertTriangleIcon,
  XCircleIcon,
  ClockIcon,
  TruckIcon,
  DollarSignIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  SlidersHorizontalIcon,
  PlusCircleIcon,
  PencilIcon,
  Trash2Icon,
  CheckCircle2Icon,
  UserRoundIcon,
  LogInIcon,
  ActivityIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { dashboardApi, itemsApi, requestsApi } from '@/lib/ims-client';
import { KpiCard, AuditActionBadge, EmptyState, ErrorState, fmtDateTime, num, prettyLabel, timeAgo, UserAvatar, usd } from './shared';
import type { DashboardResponse, ItemDto, Role } from '@/types/ims';

const PIE_COLORS = ['#059669', '#0d9488', '#f59e0b', '#8b5cf6', '#f43f5e', '#71717a', '#14b8a6', '#a1a1aa'];

function activityIcon(action: string) {
  const prefix = action.split('_')[0]?.toUpperCase();
  if (prefix === 'CREATE') return <PlusCircleIcon className="size-3.5 text-emerald-500" />;
  if (prefix === 'UPDATE') return <PencilIcon className="size-3.5 text-amber-500" />;
  if (prefix === 'DELETE') return <Trash2Icon className="size-3.5 text-rose-500" />;
  if (prefix === 'APPROVE') return <CheckCircle2Icon className="size-3.5 text-emerald-500" />;
  if (prefix === 'ISSUE') return <ArrowUpRightIcon className="size-3.5 text-violet-500" />;
  if (prefix === 'RETURN') return <ArrowDownLeftIcon className="size-3.5 text-teal-500" />;
  if (prefix === 'AUTH') return <LogInIcon className="size-3.5 text-zinc-500" />;
  return <ActivityIcon className="text-muted-foreground size-3.5" />;
}

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

/**
 * Reorder suggestions — reorder-point practice (target = 2× min stock level).
 * One-click creates a restock request routed to the store team.
 */
function ReorderSuggestions() {
  const qc = useQueryClient();
  const [requested, setRequested] = React.useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['reorder-suggestions'],
    queryFn: () => itemsApi.list({ lowStock: true, pageSize: 6, sort: 'quantity', order: 'asc' }),
    staleTime: 30_000,
  });

  const requestRestock = useMutation({
    mutationFn: (item: ItemDto) => {
      const suggested = Math.max(item.minStockLevel * 2 - item.quantity, 1);
      return requestsApi.create({
        itemId: item.id,
        quantity: suggested,
        reason: `Restock: at/below min level (${item.quantity}/${item.minStockLevel})`,
      });
    },
    onSuccess: (_res, item) => {
      setRequested((m) => ({ ...m, [item.id]: true }));
      toast.success('Restock request submitted', {
        description: `${item.name} — suggested ${Math.max(item.minStockLevel * 2 - item.quantity, 1)} ${item.unit}`,
      });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to submit restock request'),
  });

  const items = data?.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontalIcon className="size-4 text-amber-500" aria-hidden />
          Reorder suggestions
        </CardTitle>
        <CardDescription>Items at or below minimum — suggested quantity targets 2× min level.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pt-0">
        {isLoading ? (
          <div className="space-y-2 px-6 pb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2Icon className="size-5 text-emerald-500" />}
            title="Stock levels are healthy"
            description="Nothing is at or below its minimum level right now."
          />
        ) : (
          <ScrollArea className="max-h-64">
            <ul className="divide-y px-6 pb-2">
              {items.map((item) => {
                const suggested = Math.max(item.minStockLevel * 2 - item.quantity, 1);
                return (
                  <li key={item.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{item.name}</p>
                      <p className="text-muted-foreground truncate text-[11px] font-mono">
                        {item.code} · {item.quantity}/{item.minStockLevel} {item.unit} on hand
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-700 tabular-nums dark:text-amber-400">
                      +{suggested} {item.unit}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 text-[11px]"
                      disabled={requested[item.id] || requestRestock.isPending}
                      onClick={() => requestRestock.mutate(item)}
                    >
                      {requested[item.id] ? (
                        <>
                          <CheckCircle2Icon className="size-3 text-emerald-500" /> Requested
                        </>
                      ) : (
                        <>
                          <PlusCircleIcon className="size-3" /> Restock
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function KpiRow({ data, role }: { data?: DashboardResponse; role: Role }) {
  const k = data?.kpis;
  const loading = !data;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
      <KpiCard index={0} label="Total Items" value={num(k?.totalItems ?? 0)} icon={<PackageIcon className="size-4" />} loading={loading} hint="in catalogue" />
      <KpiCard index={1} label="Stock Units" value={num(k?.totalUnits ?? 0)} icon={<BoxesIcon className="size-4" />} tone="emerald" loading={loading} hint="all warehouse units" />
      <KpiCard index={2} label="Inventory Value" value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(k?.inventoryValue ?? 0)} icon={<DollarSignIcon className="size-4" />} tone="emerald" loading={loading} hint="qty × unit price" />
      <KpiCard index={3} label="Low Stock" value={num(k?.lowStockCount ?? 0)} icon={<AlertTriangleIcon className="size-4" />} tone="amber" loading={loading} hint="at/below min level" />
      <KpiCard index={4} label="Out of Stock" value={num(k?.outOfStockCount ?? 0)} icon={<XCircleIcon className="size-4" />} tone="rose" loading={loading} hint="needs replenishment" />
      <KpiCard
        index={5}
        label={role === 'STAFF' ? 'My Pending' : 'Pending Requests'}
        value={num(k?.pendingRequests ?? 0)}
        icon={<ClockIcon className="size-4" />}
        tone="violet"
        loading={loading}
        hint={role === 'STAFF' ? 'awaiting review' : 'awaiting review'}
      />
      <KpiCard index={6} label="Active Loans" value={num(k?.activeLoans ?? 0)} icon={<TruckIcon className="size-4" />} loading={loading} hint="issued, not returned" />
    </div>
  );
}

export function DashboardView({ role }: { role: Role }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.get,
    retry: 1,
  });

  return (
    <div className="space-y-6">
      <KpiRow data={data} role={role} />

      {isError ? (
        <Card>
          <ErrorState
            message={error instanceof Error ? error.message : 'Failed to load dashboard data.'}
            onRetry={() => refetch()}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Stock movement */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Stock movement (last 7 days)</CardTitle>
                <CardDescription>Daily inbound vs outbound units across the store.</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pt-2 sm:px-4">
                {isLoading ? (
                  <ChartSkeleton height={260} />
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={data?.movements7d ?? []} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.30} />
                            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                        <RTooltip
                          contentStyle={{
                            background: 'var(--popover)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area type="monotone" dataKey="in" name="IN" stroke="#10b981" strokeWidth={2} fill="url(#inFill)" />
                        <Area type="monotone" dataKey="out" name="OUT" stroke="#f43f5e" strokeWidth={2} fill="url(#outFill)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}
              </CardContent>
            </Card>

            {/* Category breakdown pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Category breakdown</CardTitle>
                <CardDescription>Items per category.</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pt-2">
                {isLoading ? (
                  <ChartSkeleton height={260} />
                ) : (data?.categoryBreakdown.length ?? 0) === 0 ? (
                  <EmptyState title="No categories yet" description="Add items and categories to see the breakdown." />
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={data?.categoryBreakdown ?? []}
                          dataKey="itemCount"
                          nameKey="name"
                          innerRadius={52}
                          outerRadius={86}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {(data?.categoryBreakdown ?? []).map((entry, i) => (
                            <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RTooltip
                          contentStyle={{
                            background: 'var(--popover)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11 }}
                          formatter={(value: string) => <span className="text-foreground">{prettyLabel(value)}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Reorder suggestions (reorder-point practice) */}
          <ReorderSuggestions />

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top requested */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top requested items</CardTitle>
                <CardDescription>Most frequently requested items.</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pt-2 sm:px-4">
                {isLoading ? (
                  <ChartSkeleton height={240} />
                ) : (data?.topRequested.length ?? 0) === 0 ? (
                  <EmptyState title="No requests yet" description="Requests will appear here once staff start ordering." />
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={data?.topRequested ?? []} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={130}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <RTooltip
                          contentStyle={{
                            background: 'var(--popover)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="requestCount" name="Requests" fill="#0d9488" radius={[0, 6, 6, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}
              </CardContent>
            </Card>

            {/* Recent activity */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent activity</CardTitle>
                <CardDescription>Latest actions from the audit trail.</CardDescription>
              </CardHeader>
              <CardContent className="px-0 pt-2">
                {isLoading ? (
                  <div className="space-y-3 px-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : (data?.recentActivity.length ?? 0) === 0 ? (
                  <EmptyState title="No activity yet" description="Actions like creating items or approving requests will show up here." />
                ) : (
                  <ScrollArea className="h-[240px] px-6">
                    <ul className="space-y-3 pb-2">
                      {(data?.recentActivity ?? []).map((a) => (
                        <li key={a.id} className="flex items-start gap-2.5">
                          <UserAvatar
                            firstName={a.actorName?.split(' ')[0] ?? null}
                            lastName={a.actorName?.split(' ').slice(1).join(' ') ?? null}
                            className="size-7 text-[10px]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-1.5 text-xs leading-snug">
                              <span className="font-semibold">{a.actorName ?? 'System'}</span>
                              <AuditActionBadge action={a.action} />
                              <span className="text-muted-foreground truncate">
                                {a.entity}
                                {a.entityId ? ` · ${a.entityId.slice(0, 8)}` : ''}
                              </span>
                            </p>
                            <p className="text-muted-foreground text-[11px]" title={fmtDateTime(a.createdAt)}>
                              {timeAgo(a.createdAt)}
                              {a.details ? ` · ${a.details}` : ''}
                            </p>
                          </div>
                          <span className="mt-0.5 shrink-0">{activityIcon(a.action)}</span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
