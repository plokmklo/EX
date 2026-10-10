'use client';

/**
 * EX-IMS global command palette (⌘K / Ctrl+K):
 * navigation, quick actions and live item search — cmdk via shadcn Command.
 */
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import {
  LayoutDashboardIcon,
  PackageIcon,
  ClipboardListIcon,
  UsersIcon,
  BarChart3Icon,
  ScrollTextIcon,
  SettingsIcon,
  SearchIcon,
  MoonIcon,
  SunIcon,
  PlusIcon,
  PackageSearchIcon,
  CornerDownLeftIcon,
  FileDownIcon,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { itemsApi } from '@/lib/ims-client';
import type { ImsView, Role, SafeUser } from '@/types/ims';

interface PaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SafeUser;
  onNavigate: (view: ImsView, opts?: { inventorySearch?: string }) => void;
}

const NAV_ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboardIcon,
  inventory: PackageIcon,
  requests: ClipboardListIcon,
  users: UsersIcon,
  reports: BarChart3Icon,
  audit: ScrollTextIcon,
  settings: SettingsIcon,
};

const NAV_LABELS: Record<ImsView, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  requests: 'Requests',
  users: 'User Management',
  reports: 'Reports & Analytics',
  audit: 'Audit Log',
  settings: 'Settings',
};

export function CommandPalette({ open, onOpenChange, user, onNavigate }: PaletteProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: itemResults, isFetching } = useQuery({
    queryKey: ['palette-items', debounced],
    queryFn: () => itemsApi.list({ search: debounced, pageSize: 6, sort: 'name', order: 'asc' }),
    enabled: open && debounced.length >= 2,
    staleTime: 10_000,
  });

  const run = (action: () => void) => {
    onOpenChange(false);
    // defer so the dialog closes before the view switches
    setTimeout(action, 60);
  };

  const navTo = (view: ImsView, opts?: { inventorySearch?: string }) =>
    run(() => onNavigate(view, opts));

  const toggleTheme = () =>
    run(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'));

  const exportCsv = () =>
    run(() => {
      window.location.href = '/api/reports/export?type=inventory';
    });

  const views: ImsView[] = (
    [
      'dashboard',
      'inventory',
      'requests',
      ['ADMIN', 'MANAGER'].includes(user.role) ? 'users' : null,
      ['ADMIN', 'MANAGER'].includes(user.role) ? 'reports' : null,
      ['ADMIN', 'MANAGER'].includes(user.role) ? 'audit' : null,
      'settings',
    ] as (ImsView | null)[]
  ).filter((v): v is ImsView => v !== null);

  const canManage = user.role === 'ADMIN' || user.role === 'STOREKEEPER';
  const canExport = user.role === 'ADMIN' || user.role === 'MANAGER';
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search items or jump to a page…"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="min-h-72">
        <CommandEmpty>
          {debounced.length >= 2 && !isFetching ? (
            <span className="text-muted-foreground flex flex-col items-center gap-1 py-6 text-xs">
              <PackageSearchIcon className="size-5" />
              No items match &ldquo;{debounced}&rdquo;
            </span>
          ) : (
            <span className="text-muted-foreground py-6 text-xs">Type to search items…</span>
          )}
        </CommandEmpty>

        {debounced.length >= 2 && (itemResults?.data.length ?? 0) > 0 && (
          <>
            <CommandGroup heading="Items">
              {itemResults!.data.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`item-${item.code}-${item.name}`}
                  onSelect={() => navTo('inventory', { inventorySearch: item.code })}
                  className="gap-3"
                >
                  <PackageIcon className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{item.name}</p>
                    <p className="text-muted-foreground truncate text-[11px] font-mono">
                      {item.code} · {item.quantity} {item.unit} · {item.category.name}
                    </p>
                  </div>
                  <CornerDownLeftIcon className="text-muted-foreground size-3.5 shrink-0" />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navigate">
          {views.map((v) => {
            const Icon = NAV_ICONS[v];
            return (
              <CommandItem key={v} value={`go-${v}`} onSelect={() => navTo(v)}>
                <Icon className="text-muted-foreground size-4" />
                {NAV_LABELS[v]}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {(canManage || canExport || true) && <CommandSeparator />}
        <CommandGroup heading="Quick actions">
          <CommandItem value="toggle-theme" onSelect={toggleTheme}>
            {resolvedTheme === 'dark' ? (
              <SunIcon className="text-muted-foreground size-4" />
            ) : (
              <MoonIcon className="text-muted-foreground size-4" />
            )}
            Toggle {resolvedTheme === 'dark' ? 'light' : 'dark'} mode
            <CommandShortcut>{isMac ? '⌘' : 'Ctrl'}+K then ↵</CommandShortcut>
          </CommandItem>
          {canExport && (
            <CommandItem value="export-inventory" onSelect={exportCsv}>
              <FileDownIcon className="text-muted-foreground size-4" />
              Export inventory CSV
            </CommandItem>
          )}
          {canManage && (
            <CommandItem
              value="add-item"
              onSelect={() => navTo('inventory')}
            >
              <PlusIcon className="text-muted-foreground size-4" />
              New item (via Inventory)
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
      <div className="text-muted-foreground flex items-center justify-between border-t px-3 py-2 text-[10px]">
        <span className="flex items-center gap-1">
          <SearchIcon className="size-3" /> EX-IMS command palette
        </span>
        <span className="flex items-center gap-2">
          <kbd className="bg-muted rounded border px-1 font-mono">↑↓</kbd> navigate
          <kbd className="bg-muted rounded border px-1 font-mono">esc</kbd> close
        </span>
      </div>
    </CommandDialog>
  );
}

/** Global ⌘K / Ctrl+K hook — registers the shortcut for the palette. */
export function useCommandPaletteShortcut(onOpen: () => void) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}
