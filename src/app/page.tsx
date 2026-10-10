'use client';

/**
 * EX-IMS single-page application root.
 * Providers → session bootstrap (GET /api/auth/me) → LoginView or AppShell
 * with client-side view switching (no other routes).
 */
import * as React from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2Icon } from 'lucide-react';
import { authApi } from '@/lib/ims-client';
import { LoginView } from '@/components/ims/login-view';
import { AppShell } from '@/components/ims/app-shell';
import { DashboardView } from '@/components/ims/dashboard-view';
import { InventoryView } from '@/components/ims/inventory-view';
import { RequestsView } from '@/components/ims/requests-view';
import { UsersView } from '@/components/ims/users-view';
import { ReportsView } from '@/components/ims/reports-view';
import { AuditView } from '@/components/ims/audit-view';
import { SettingsView } from '@/components/ims/settings-view';
import type { ImsView, SafeUser } from '@/types/ims';

import { useImsStore } from '@/lib/ims-store';

/* ------------------------------ View switch ------------------------------ */

function CurrentView({ user }: { user: SafeUser }) {
  const currentView = useImsStore((s) => s.currentView);

  const views: Record<ImsView, React.ReactNode> = {
    dashboard: <DashboardView role={user.role} />,
    inventory: <InventoryView user={user} />,
    requests: <RequestsView user={user} />,
    users: <UsersView user={user} />,
    reports: <ReportsView />,
    audit: <AuditView />,
    settings: <SettingsView user={user} />,
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentView}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {views[currentView]}
      </motion.div>
    </AnimatePresence>
  );
}

/* ------------------------------ Session gate ------------------------------ */

function SessionGate() {
  const qc = useQueryClient();
  const currentView = useImsStore((s) => s.currentView);
  const setView = useImsStore((s) => s.setView);
  const navigateToInventory = useImsStore((s) => s.navigateToInventory);

  const { data, isLoading } = useQuery({
    queryKey: ['session'],
    queryFn: authApi.me,
    retry: false, // 401 → logged-out state
    staleTime: 60_000,
  });

  const user = data?.user ?? null;

  const handleNavigate = (v: ImsView, opts?: { inventorySearch?: string }) => {
    if (v === 'inventory' && opts?.inventorySearch !== undefined) {
      navigateToInventory(opts.inventorySearch);
    } else {
      setView(v);
    }
  };

  const handleSignedIn = (u: SafeUser) => {
    qc.setQueryData(['session'], { user: u });
    setView('dashboard');
    // Warm up the data cache for the fresh session.
    qc.invalidateQueries();
  };

  const handleSignOut = () => {
    qc.setQueryData(['session'], null);
    qc.cancelQueries();
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
    setView('dashboard');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Loading application">
        <div className="flex flex-col items-center gap-3">
          <Loader2Icon className="size-8 animate-spin text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="text-muted-foreground text-sm font-medium">Starting EX-IMS…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onSignedIn={handleSignedIn} />;
  }

  return (
    <AppShell
      user={user}
      view={currentView}
      onNavigate={handleNavigate}
      onSignOut={handleSignOut}
    >
      <CurrentView user={user} />
    </AppShell>
  );
}

/* ------------------------------ Root ------------------------------ */

export default function Home() {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 15_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <SessionGate />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
