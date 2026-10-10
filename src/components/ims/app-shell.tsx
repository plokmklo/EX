'use client';

/**
 * EX-IMS application shell: collapsible sidebar + sticky header + sticky footer.
 */
import * as React from 'react';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  LayoutDashboardIcon,
  PackageIcon,
  ClipboardListIcon,
  UsersIcon,
  BarChart3Icon,
  ScrollTextIcon,
  SettingsIcon,
  BoxesIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  MenuIcon,
  MoonIcon,
  SunIcon,
  LogOutIcon,
  UserRoundIcon,
  ChevronsUpDownIcon,
  MonitorIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader as SheetHeaderUi, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { dashboardApi, authApi } from '@/lib/ims-client';
import { RoleBadge, UserAvatar } from './shared';
import type { ImsView, Role, SafeUser } from '@/types/ims';
import { cn } from '@/lib/utils';

interface NavItem {
  id: ImsView;
  label: string;
  icon: React.ElementType;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { id: 'inventory', label: 'Inventory', icon: PackageIcon },
  { id: 'requests', label: 'Requests', icon: ClipboardListIcon, roles: ['ADMIN', 'MANAGER', 'STOREKEEPER', 'STAFF'] },
  { id: 'users', label: 'Users', icon: UsersIcon, roles: ['ADMIN', 'MANAGER'] },
  { id: 'reports', label: 'Reports', icon: BarChart3Icon, roles: ['ADMIN', 'MANAGER'] },
  { id: 'audit', label: 'Audit Log', icon: ScrollTextIcon, roles: ['ADMIN', 'MANAGER'] },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const VIEW_TITLES: Record<ImsView, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  requests: 'Requests',
  users: 'User Management',
  reports: 'Reports & Analytics',
  audit: 'Audit Log',
  settings: 'Settings',
};

const FOOTER_NAV: Record<ImsView, string> = {
  dashboard: 'Overview of stock health, movements and requests.',
  inventory: 'Catalogue, stock levels and item lifecycle.',
  requests: 'Request → approve → issue → return workflow.',
  users: 'Accounts, roles and access control.',
  reports: 'Valuation, movement and request analytics.',
  audit: 'Immutable trail of every action.',
  settings: 'Your profile, security and preferences.',
};

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === 'dark' : false;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label="Toggle theme"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {mounted && isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
      <span className="sr-only">Toggle theme (current: {theme ?? 'system'})</span>
    </Button>
  );
}

function NavList({
  user,
  view,
  pendingCount,
  collapsed,
  onNavigate,
}: {
  user: SafeUser;
  view: ImsView;
  pendingCount: number;
  collapsed: boolean;
  onNavigate: (v: ImsView) => void;
}) {
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));
  const showPendingBadge =
    pendingCount > 0 && user.role !== 'STAFF';

  return (
    <nav className="flex flex-1 flex-col gap-1 px-2 py-2" aria-label="Main navigation">
      {items.map((item) => {
        const active = view === item.id;
        const link = (
          <button
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none',
              'focus-visible:ring-ring/50 focus-visible:ring-2',
              active
                ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            <item.icon className={cn('size-4 shrink-0', active && 'text-emerald-600 dark:text-emerald-400')} aria-hidden />
            {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
            {!collapsed && item.id === 'requests' && showPendingBadge && (
              <Badge className="h-5 min-w-5 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white tabular-nums">
                {pendingCount > 99 ? '99+' : pendingCount}
              </Badge>
            )}
          </button>
        );
        return collapsed ? (
          <Tooltip key={item.id} delayDuration={0}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right" className="flex items-center gap-2">
              {item.label}
              {item.id === 'requests' && showPendingBadge && (
                <Badge className="h-5 min-w-5 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{pendingCount}</Badge>
              )}
            </TooltipContent>
          </Tooltip>
        ) : (
          <React.Fragment key={item.id}>{link}</React.Fragment>
        );
      })}
    </nav>
  );
}

function SidebarContent({
  user,
  view,
  pendingCount,
  collapsed,
  onNavigate,
  onToggleCollapse,
}: {
  user: SafeUser;
  view: ImsView;
  pendingCount: number;
  collapsed: boolean;
  onNavigate: (v: ImsView) => void;
  onToggleCollapse?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={cn('flex min-h-16 items-center gap-2.5 border-b px-4', collapsed && 'justify-center px-2')}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/15 ring-1 ring-emerald-600/30">
          <BoxesIcon className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight">EX-IMS</p>
            <p className="text-muted-foreground truncate text-[10px]">Enterprise Inventory</p>
          </div>
        )}
        {onToggleCollapse && !collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-8 shrink-0"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
          >
            <PanelLeftCloseIcon className="size-4" />
          </Button>
        )}
      </div>

      <NavList user={user} view={view} pendingCount={pendingCount} collapsed={collapsed} onNavigate={onNavigate} />

      {/* Bottom mini status */}
      <div className="border-t p-2">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex size-11 items-center justify-center">
                <UserAvatar firstName={user.firstName} lastName={user.lastName} className="size-8" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {user.firstName} {user.lastName} · {user.role}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="bg-accent/50 flex items-center gap-2.5 rounded-lg p-2.5">
            <UserAvatar firstName={user.firstName} lastName={user.lastName} className="size-8" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-muted-foreground truncate text-[10px] font-mono">{user.empId}</p>
            </div>
            <ChevronsUpDownIcon className="text-muted-foreground size-3.5" aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}

export function AppShell({
  user,
  view,
  onNavigate,
  onSignOut,
  children,
}: {
  user: SafeUser;
  view: ImsView;
  onNavigate: (v: ImsView) => void;
  onSignOut: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Pending-requests count for badge (staff sees own count on Requests page instead)
  const canSeeBadge = user.role !== 'STAFF';
  const { data: dash } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.get,
    enabled: canSeeBadge,
    staleTime: 30_000,
    retry: 1,
  });
  const pendingCount = dash?.kpis.pendingRequests ?? 0;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authApi.logout();
      toast.success('Signed out', { description: 'Your session has been cleared.' });
      await onSignOut();
    } catch {
      toast.error('Sign out failed — please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  const goTo = (v: ImsView) => {
    onNavigate(v);
    setMobileOpen(false);
  };

  const dark = mounted && resolvedTheme === 'dark';

  return (
    <TooltipProviderMaybe>
      <div className="flex min-h-screen w-full">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'bg-sidebar sticky top-0 hidden h-screen shrink-0 border-r transition-[width] duration-200 md:flex md:flex-col',
            collapsed ? 'w-16' : 'w-64',
          )}
          aria-label="Sidebar"
        >
          <SidebarContent
            user={user}
            view={view}
            pendingCount={pendingCount}
            collapsed={collapsed}
            onNavigate={goTo}
            onToggleCollapse={() => setCollapsed((c) => !c)}
          />
        </aside>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0 md:hidden">
            <SheetHeaderUi className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeaderUi>
            <SidebarContent user={user} view={view} pendingCount={pendingCount} collapsed={false} onNavigate={goTo} />
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Sticky header */}
          <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 border-b backdrop-blur">
            <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
              <Button
                variant="ghost"
                size="icon"
                className="size-9 md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
              >
                <MenuIcon className="size-5" />
              </Button>
              {collapsed && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hidden size-9 md:inline-flex"
                  onClick={() => setCollapsed(false)}
                  aria-label="Expand sidebar"
                >
                  <PanelLeftOpenIcon className="size-4" />
                </Button>
              )}

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{VIEW_TITLES[view]}</h1>
                <p className="text-muted-foreground hidden truncate text-xs sm:block">{FOOTER_NAV[view]}</p>
              </div>

              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="focus-visible:ring-ring/50 flex min-h-11 items-center gap-2 rounded-full p-1 pr-2 outline-none focus-visible:ring-2 md:pr-1"
                    aria-label="Open user menu"
                  >
                    <UserAvatar firstName={user.firstName} lastName={user.lastName} className="size-9" />
                    <span className="hidden text-left lg:block">
                      <span className="block text-xs leading-tight font-semibold">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="text-muted-foreground block text-[10px] leading-tight">{user.role}</span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-2.5 py-1">
                      <UserAvatar firstName={user.firstName} lastName={user.lastName} className="size-9" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <RoleBadge role={user.role} />
                      <Badge variant="outline" className="font-mono text-[10px]">{user.empId}</Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onNavigate('settings')}>
                    <UserRoundIcon className="size-4" /> Profile &amp; settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme(dark ? 'light' : 'dark')}
                  >
                    {dark ? <SunIcon className="size-4" /> : <MonitorIcon className="size-4" />} Toggle appearance
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" disabled={signingOut} onClick={handleSignOut}>
                    <LogOutIcon className="size-4" /> {signingOut ? 'Signing out…' : 'Sign out'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Separator />
          </header>

          {/* Content */}
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8" id="main-content">
            {children}
          </main>

          {/* Sticky footer */}
          <footer className="mt-auto border-t">
            <div className="text-muted-foreground flex flex-col items-center justify-between gap-2 px-4 py-4 text-xs sm:flex-row sm:px-6">
              <p>
                <span className="font-semibold text-foreground">EX-IMS</span> — Enterprise Inventory Management • Built
                with Next.js
              </p>
              <p className="flex items-center gap-2">
                <span>© {new Date().getFullYear()} Debre Berhan University</span>
                <Badge variant="outline" className="font-mono text-[10px]">v1.0.0</Badge>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </TooltipProviderMaybe>
  );
}

/**
 * TooltipProvider shim — the shadcn tooltip component already provides its own
 * provider in recent versions; this wrapper simply renders children.
 */
function TooltipProviderMaybe({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
