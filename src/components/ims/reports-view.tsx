'use client';

/**
 * Reports (ADMIN/MANAGER): Valuation / Movements / Requests tabs with charts,
 * tables and CSV export links.
 */
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DownloadIcon,
  DollarSignIcon,
  BoxesIcon,
  LayersIcon,
  TrendingUpIcon,
  ClockIcon,
  UserRoundIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { reportsApi } from '@/lib/ims-client';
import {
  EmptyState,
  KpiCard,
  MovementBadge,
  num,
  prettyLabel,
  usd,
} from './shared';

const BAR_COLORS = ['#059669', '#0d9488', '#f59e0b', '#8b5cf6', '#f43f5e', '#71717a'];

function ExportButton({ type, label }: { type: string; label: string }) {
  return (
    <Button variant="outline" size="sm" className="h-9" asChild>
      <a href={`/api/reports/export?type=${type}`} aria-label={`Export ${label} as CSV`}>
        <DownloadIcon className="size-3.5" /> Export CSV
      </a>
    </Button>
  );
}

/* ------------------------------- Valuation ------------------------------- */

function ValuationTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'valuation'],
    queryFn: reportsApi.valuation,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }
  if (isError || !data) return <EmptyState title="Valuation unavailable" description="Try again in a moment." />;

  const { data: rows, totals } = data;
  const max = Math.max(1, ...rows.map((r) => r.totalValue));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total inventory value" value={usd(totals.totalValue)} icon={<DollarSignIcon className="size-4" />} tone="emerald" />
        <KpiCard label="Total units" value={num(totals.totalUnits)} icon={<BoxesIcon className="size-4" />} />
        <KpiCard label="Tracked items" value={num(totals.totalItems)} icon={<LayersIcon className="size-4" />} />
        <KpiCard label="Categories" value={num(totals.categories)} icon={<LayersIcon className="size-4" />} tone="violet" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Value by category</CardTitle>
            <CardDescription>Share of total inventory value per category.</CardDescription>
          </div>
          <ExportButton type="inventory" label="inventory" />
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState title="No inventory value yet" description="Add items with quantities and prices to see valuation." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="w-48">% of total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows
                  .slice()
                  .sort((a, b) => b.totalValue - a.totalValue)
                  .map((r) => {
                    const pct = totals.totalValue > 0 ? (r.totalValue / totals.totalValue) * 100 : 0;
                    return (
                      <TableRow key={r.categoryId}>
                        <TableCell className="text-sm font-medium">{r.categoryName}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(r.itemCount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(r.totalUnits)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{usd(r.totalValue)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-2 [&>div]:bg-emerald-500" aria-label={`${pct.toFixed(1)} percent`} />
                            <span className="w-12 shrink-0 text-right text-xs tabular-nums">{pct.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Value distribution</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rows.slice().sort((a, b) => b.totalValue - a.totalValue)} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="categoryName" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <RTooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="totalValue" name="Value (USD)" radius={[6, 6, 0, 0]}>
                  {rows.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------- Movements ------------------------------- */

function MovementsTab() {
  const [days, setDays] = React.useState('30');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'movements', days],
    queryFn: () => reportsApi.movements(Number(days)),
    retry: 1,
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">Period:</span>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-36" aria-label="Period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ExportButton type="movements" label="movements" />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState title="Movements unavailable" description="Try again in a moment." />
        ) : rows.length === 0 ? (
          <EmptyState title="No movements in this period" description="IN/OUT/ADJUST records will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell><MovementBadge type={m.type} /></TableCell>
                    <TableCell>
                      <p className="max-w-56 truncate text-sm font-medium">{m.item.name}</p>
                      <p className="text-muted-foreground font-mono text-xs">{m.item.code}</p>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{m.quantity}</TableCell>
                    <TableCell className="text-xs">{m.user ? `${m.user.firstName} ${m.user.lastName}` : 'System'}</TableCell>
                    <TableCell className="text-muted-foreground max-w-40 truncate text-xs">{m.note ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-right text-xs whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------- Requests ------------------------------- */

function RequestsAnalyticsTab() {
  const [days, setDays] = React.useState('30');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'requests', days],
    queryFn: () => reportsApi.requests(Number(days)),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }
  if (isError || !data) return <EmptyState title="Analytics unavailable" description="Try again in a moment." />;

  const avg = data.avgDecisionHours;
  const avgLabel =
    avg == null ? '—' : avg < 1 ? `${Math.round(avg * 60)} min` : avg < 48 ? `${avg.toFixed(1)} h` : `${(avg / 24).toFixed(1)} d`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Requests in period"
          value={num(data.byStatus.reduce((s, b) => s + b.count, 0))}
          icon={<TrendingUpIcon className="size-4" />}
          tone="violet"
        />
        <KpiCard label="Avg decision time" value={avgLabel} icon={<ClockIcon className="size-4" />} hint="From submit to approve/reject" />
        <KpiCard label="Top requester" value={data.topRequesters[0]?.name?.split(' ')[0] ?? '—'} icon={<UserRoundIcon className="size-4" />} hint={data.topRequesters[0] ? `${data.topRequesters[0].count} requests` : undefined} />
        <KpiCard label="Distinct statuses" value={num(data.byStatus.length)} icon={<LayersIcon className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Requests by status</CardTitle>
              <CardDescription>Distribution across the workflow.</CardDescription>
            </div>
            <ExportButton type="requests" label="requests" />
          </CardHeader>
          <CardContent className="px-2 pt-2 sm:px-4">
            {data.byStatus.length === 0 ? (
              <EmptyState title="No requests in this period" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.byStatus} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={90} tickLine={false} axisLine={false} tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => prettyLabel(v)} />
                  <RTooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" name="Requests" radius={[0, 6, 6, 0]} barSize={16} fill="#0d9488" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Requests per day</CardTitle>
            <CardDescription>Submission volume over the period.</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pt-2 sm:px-4">
            {data.byDay.length === 0 ? (
              <EmptyState title="No data" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.byDay} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reqFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                  <RTooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" name="Requests" stroke="#14b8a6" strokeWidth={2} fill="url(#reqFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top requesters</CardTitle>
          <CardDescription>Most active staff members in the period.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.topRequesters.length === 0 ? (
            <EmptyState title="No requesters yet" />
          ) : (
            <ul className="space-y-2.5">
              {data.topRequesters.map((t, i) => {
                const maxCount = Math.max(1, ...data.topRequesters.map((x) => x.count));
                return (
                  <li key={t.name} className="flex items-center gap-3">
                    <Badge variant="outline" className="w-6 justify-center font-mono text-[10px]">{i + 1}</Badge>
                    <span className="w-36 shrink-0 truncate text-sm font-medium sm:w-48">{t.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(t.count / maxCount) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs tabular-nums">{t.count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ------------------------------- Wrapper ------------------------------- */

export function ReportsView() {
  return (
    <Tabs defaultValue="valuation" className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="valuation">Valuation</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="valuation"><ValuationTab /></TabsContent>
      <TabsContent value="movements"><MovementsTab /></TabsContent>
      <TabsContent value="requests"><RequestsAnalyticsTab /></TabsContent>
    </Tabs>
  );
}
