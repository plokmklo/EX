'use client';

/**
 * Settings: profile editing, password change with strength meter,
 * theme preference, and an About card with role permission matrix.
 */
import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import {
  UserRoundIcon,
  KeyRoundIcon,
  PaletteIcon,
  InfoIcon,
  Loader2Icon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  XIcon,
  BoxesIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { authApi, ApiError } from '@/lib/ims-client';
import { RoleBadge, UserAvatar } from './shared';
import type { SafeUser } from '@/types/ims';
import { cn } from '@/lib/utils';

/* ------------------------------ Profile ------------------------------ */

const profileSchema = z.object({
  firstName: z.string().min(1, 'Required').max(60),
  lastName: z.string().min(1, 'Required').max(60),
  phone: z.string().max(24).optional().or(z.literal('')),
  department: z.string().max(80).optional().or(z.literal('')),
  office: z.string().max(80).optional().or(z.literal('')),
});

type ProfileValues = z.infer<typeof profileSchema>;

function ProfileCard({ user }: { user: SafeUser }) {
  const qc = useQueryClient();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? '',
      department: user.department ?? '',
      office: user.office ?? '',
    },
  });

  const save = useMutation({
    mutationFn: (v: ProfileValues) =>
      authApi.updateProfile({
        firstName: v.firstName,
        lastName: v.lastName,
        phone: v.phone || undefined,
        department: v.department || undefined,
        office: v.office || undefined,
      }),
    onSuccess: (res) => {
      toast.success('Profile updated');
      qc.setQueryData(['session'], { user: res.user });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) =>
      toast.error('Update failed', {
        description: err instanceof ApiError ? err.message : 'Unexpected error — try again.',
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRoundIcon className="size-4 text-emerald-600 dark:text-emerald-400" /> Profile
        </CardTitle>
        <CardDescription>How you appear across the system.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex items-center gap-3">
          <UserAvatar firstName={user.firstName} lastName={user.lastName} className="size-14 text-base" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-muted-foreground truncate text-xs">{user.email}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <RoleBadge role={user.role} />
              <Badge variant="outline" className="font-mono text-[10px]">{user.empId}</Badge>
            </div>
          </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="office" render={({ field }) => (
                <FormItem>
                  <FormLabel>Office</FormLabel>
                  <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={save.isPending}>
                {save.isPending && <Loader2Icon className="size-4 animate-spin" />} Save profile
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Security ------------------------------ */

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

function passwordStrength(pw: string): { score: number; label: string; cls: string } {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  const cls = ['bg-rose-500', 'bg-rose-500', 'bg-amber-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-500'];
  return { score, label: labels[score], cls: cls[score] };
}

function SecurityCard() {
  const [show, setShow] = React.useState(false);
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPassword = useWatch({ control: form.control, name: 'newPassword' }) ?? '';
  const strength = passwordStrength(newPassword);

  const change = useMutation({
    mutationFn: (v: PasswordValues) => authApi.changePassword(v.currentPassword, v.newPassword),
    onSuccess: () => {
      toast.success('Password changed', { description: 'Use your new password next time you sign in.' });
      form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err) =>
      toast.error('Password change failed', {
        description: err instanceof ApiError ? err.message : 'Unexpected error — try again.',
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRoundIcon className="size-4 text-emerald-600 dark:text-emerald-400" /> Security
        </CardTitle>
        <CardDescription>Change your password. Sessions stay valid until signed out.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => change.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="currentPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>Current password</FormLabel>
                <FormControl>
                  <Input type={show ? 'text' : 'password'} autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="newPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input type={show ? 'text' : 'password'} autoComplete="new-password" className="pr-10" {...field} />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
                    aria-label={show ? 'Hide passwords' : 'Show passwords'}
                  >
                    {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </button>
                </div>
                {(newPassword ?? '').length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex h-1.5 flex-1 gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn('h-full flex-1 rounded-full', i < strength.score ? strength.cls : 'bg-zinc-200 dark:bg-zinc-700')}
                        />
                      ))}
                    </div>
                    <span className="w-20 text-right text-[11px] font-medium">{strength.label}</span>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="confirmPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input type={show ? 'text' : 'password'} autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-end">
              <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={change.isPending}>
                {change.isPending && <Loader2Icon className="size-4 animate-spin" />} Change password
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Preferences ------------------------------ */

function PreferencesCard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PaletteIcon className="size-4 text-emerald-600 dark:text-emerald-400" /> Preferences
        </CardTitle>
        <CardDescription>Appearance follows your choice or the operating system.</CardDescription>
      </CardHeader>
      <CardContent className="max-w-xs">
        <Label htmlFor="theme-select" className="text-xs">Theme</Label>
        <Select value={mounted ? (theme ?? 'system') : 'system'} onValueChange={setTheme}>
          <SelectTrigger id="theme-select" className="mt-1.5 w-full">
            <SelectValue placeholder="Choose theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground mt-2 text-[11px]">
          Current: {mounted ? (theme === 'system' ? 'system (auto)' : theme) : 'system (auto)'}
        </p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ About / permission matrix ------------------------------ */

const PERMISSIONS: { area: string; admin: boolean; manager: boolean; storekeeper: boolean; staff: boolean }[] = [
  { area: 'View dashboard & inventory', admin: true, manager: true, storekeeper: true, staff: true },
  { area: 'Add / edit items', admin: true, manager: false, storekeeper: true, staff: false },
  { area: 'Delete items', admin: true, manager: false, storekeeper: false, staff: false },
  { area: 'Request stock', admin: true, manager: true, storekeeper: true, staff: true },
  { area: 'Approve / reject requests', admin: true, manager: true, storekeeper: true, staff: false },
  { area: 'Issue & receive returns', admin: true, manager: false, storekeeper: true, staff: false },
  { area: 'Manage categories', admin: true, manager: false, storekeeper: true, staff: false },
  { area: 'View users', admin: true, manager: true, storekeeper: false, staff: false },
  { area: 'Create / edit users', admin: true, manager: false, storekeeper: false, staff: false },
  { area: 'Reports & CSV export', admin: true, manager: true, storekeeper: false, staff: false },
  { area: 'Audit log', admin: true, manager: true, storekeeper: false, staff: false },
];

function PermCell({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckIcon className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" aria-label="Allowed" />
  ) : (
    <XIcon className="text-muted-foreground/40 mx-auto size-4" aria-label="Not allowed" />
  );
}

function AboutCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <InfoIcon className="size-4 text-emerald-600 dark:text-emerald-400" /> About EX-IMS
        </CardTitle>
        <CardDescription>System information and the role permission matrix.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-600/15 ring-1 ring-emerald-600/30">
            <BoxesIcon className="size-6 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-bold">EX-IMS — Enterprise Inventory Management System</p>
            <p className="text-muted-foreground text-xs">
              Debre Berhan University · Enterprise Edition · <Badge variant="outline" className="ml-1 font-mono text-[10px]">v1.0.0</Badge>
            </p>
          </div>
        </div>
        <Separator />
        <div>
          <p className="mb-2 text-xs font-semibold">Role permission matrix</p>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Capability</TableHead>
                  <TableHead className="text-center">Admin</TableHead>
                  <TableHead className="text-center">Manager</TableHead>
                  <TableHead className="text-center">Storekeeper</TableHead>
                  <TableHead className="text-center">Staff</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PERMISSIONS.map((p) => (
                  <TableRow key={p.area}>
                    <TableCell className="text-xs">{p.area}</TableCell>
                    <TableCell><PermCell ok={p.admin} /></TableCell>
                    <TableCell><PermCell ok={p.manager} /></TableCell>
                    <TableCell><PermCell ok={p.storekeeper} /></TableCell>
                    <TableCell><PermCell ok={p.staff} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground mt-2 text-[11px]">
            All permissions are enforced server-side on every request — the UI only hides what the role cannot do.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Wrapper ------------------------------ */

export function SettingsView({ user }: { user: SafeUser }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ProfileCard user={user} />
      <SecurityCard />
      <PreferencesCard />
      <AboutCard />
    </div>
  );
}
