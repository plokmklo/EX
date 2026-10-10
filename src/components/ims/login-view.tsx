'use client';

/**
 * EX-IMS split-screen enterprise login.
 */
import * as React from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  BoxesIcon,
  ShieldCheckIcon,
  ClipboardCheckIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  AlertCircleIcon,
  ArrowRightIcon,
  WarehouseIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ApiError, authApi } from '@/lib/ims-client';
import type { SafeUser } from '@/types/ims';
import { cn } from '@/lib/utils';

const DEMO_ACCOUNTS: { role: string; identifier: string; password: string }[] = [
  { role: 'Admin', identifier: 'admin@ex-ims.dev', password: 'Admin@123' },
  { role: 'Manager', identifier: 'manager@ex-ims.dev', password: 'Manager@123' },
  { role: 'Clerk', identifier: 'clerk@ex-ims.dev', password: 'Clerk@123' },
  { role: 'Staff', identifier: 'staff@ex-ims.dev', password: 'Staff@123' },
];

const FEATURES = [
  {
    icon: WarehouseIcon,
    title: 'Real-time stock ledger',
    text: 'Every IN/OUT/ADJUST movement recorded — perpetual inventory, zero drift.',
  },
  {
    icon: ClipboardCheckIcon,
    title: 'Request → Approve → Issue → Return',
    text: 'Full custody workflow with reservations, decision notes and audit trail.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Enterprise RBAC & audit',
    text: 'Four roles, signed httpOnly sessions, rate limiting, immutable audit log.',
  },
];

export function LoginView({ onSignedIn }: { onSignedIn: (user: SafeUser) => void }) {
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please enter your identifier and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await authApi.login(identifier.trim(), password);
      toast.success(`Welcome back, ${user.firstName}`, {
        description: `Signed in as ${user.role.replace('_', ' ').toLowerCase()} • ${user.email}`,
      });
      onSignedIn(user);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const quickFill = (identifier: string, password: string) => {
    setIdentifier(identifier);
    setPassword(password);
    setError(null);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60rem 40rem at -10% -20%, rgba(16,185,129,0.35), transparent 60%), radial-gradient(50rem 36rem at 120% 120%, rgba(13,148,136,0.30), transparent 60%)',
          }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40">
            <BoxesIcon className="size-6 text-emerald-400" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight">EX-IMS</p>
            <p className="text-[11px] tracking-wide text-zinc-400">Debre Berhan University · Enterprise Edition</p>
          </div>
        </div>

        <div className="relative max-w-md space-y-8">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="text-3xl leading-tight font-bold tracking-tight"
          >
            Enterprise Inventory &amp; Asset Control
          </motion.h1>
          <div className="space-y-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.08 }}
                className="flex gap-3"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
                  <f.icon className="size-4 text-emerald-400" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs leading-relaxed text-zinc-400">{f.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative text-[11px] text-zinc-500">
          © {new Date().getFullYear()} EX-IMS · Built with Next.js · v1.0.0
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600/15 ring-1 ring-emerald-600/30">
              <BoxesIcon className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <div>
              <p className="font-bold tracking-tight">EX-IMS</p>
              <p className="text-muted-foreground text-[11px]">Enterprise Inventory &amp; Asset Control</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Use your email or employee ID to access the inventory system.
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Email or employee ID</Label>
              <Input
                id="identifier"
                autoComplete="username"
                placeholder="you@ex-ims.dev or EMP-1001"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-700 dark:text-rose-400" role="alert">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" aria-hidden /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRightIcon className="size-4" aria-hidden />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8">
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Demo accounts</span>
              <Separator className="flex-1" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => quickFill(acc.identifier, acc.password)}
                  className={cn(
                    'group flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors',
                    'hover:border-emerald-500/50 hover:bg-emerald-500/5',
                  )}
                  aria-label={`Fill credentials for demo ${acc.role} account`}
                >
                  <span>
                    <span className="block text-xs font-semibold">{acc.role}</span>
                    <span className="text-muted-foreground block font-mono text-[10px]">{acc.identifier}</span>
                  </span>
                  <span className="text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 text-[10px]">
                    Fill →
                  </span>
                </button>
              ))}
            </div>
            <p className="text-muted-foreground mt-2 text-center text-[11px]">
              Click a chip to pre-fill, then press “Sign in”.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
