'use client';

/**
 * User management (ADMIN/MANAGER): search, role/status filters, add/edit user
 * dialogs with password generator, activate/deactivate with confirm.
 */
import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  SearchIcon,
  PlusIcon,
  RefreshCcwIcon,
  MoreHorizontalIcon,
  PencilIcon,
  ShieldBanIcon,
  ShieldCheckIcon,
  UsersIcon,
  Wand2Icon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { usersApi, ApiError } from '@/lib/ims-client';
import { EmptyState, ErrorState, fmtDate, PaginationFooter, RoleBadge, UserAvatar, UserStatusBadge } from './shared';
import type { Role, SafeUser, UserStatus } from '@/types/ims';

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: 'ADMIN', label: 'Admin', desc: 'Full control: users, items, settings, audit.' },
  { value: 'MANAGER', label: 'Manager', desc: 'Reports, audit, approvals and oversight.' },
  { value: 'STOREKEEPER', label: 'Storekeeper', desc: 'Day-to-day stock: items, issue, return.' },
  { value: 'STAFF', label: 'Staff', desc: 'Browse catalogue and request stock.' },
];

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$%!';
  const all = upper + lower + digits + special;
  let out =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)] +
    special[Math.floor(Math.random() * special.length)];
  for (let i = 0; i < 8; i++) out += all[Math.floor(Math.random() * all.length)];
  return out;
}

const createSchema = z.object({
  empId: z.string().min(2, 'Employee ID required').max(20),
  firstName: z.string().min(1, 'Required').max(60),
  lastName: z.string().min(1, 'Required').max(60),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'At least 8 characters'),
  role: z.enum(['ADMIN', 'MANAGER', 'STOREKEEPER', 'STAFF']),
  phone: z.string().max(24).optional().or(z.literal('')),
  department: z.string().max(80).optional().or(z.literal('')),
  office: z.string().max(80).optional().or(z.literal('')),
});

const editSchema = z.object({
  firstName: z.string().min(1, 'Required').max(60),
  lastName: z.string().min(1, 'Required').max(60),
  email: z.string().email('Valid email required'),
  role: z.enum(['ADMIN', 'MANAGER', 'STOREKEEPER', 'STAFF']),
  phone: z.string().max(24).optional().or(z.literal('')),
  department: z.string().max(80).optional().or(z.literal('')),
  office: z.string().max(80).optional().or(z.literal('')),
  password: z.string().max(64).optional().or(z.literal('')),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

export function UsersView({ user }: { user: SafeUser }) {
  const qc = useQueryClient();
  const isAdmin = user.role === 'ADMIN';

  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [role, setRole] = React.useState<Role | ''>('');
  const [status, setStatus] = React.useState<UserStatus | ''>('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['users', { search, role, status, page, pageSize }],
    queryFn: () =>
      usersApi.list({
        search: search || undefined,
        role: role || undefined,
        status: status || undefined,
        page,
        pageSize,
      }),
    placeholderData: (prev) => prev,
  });

  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SafeUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = React.useState<SafeUser | null>(null);

  const setStatusMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'ACTIVE' | 'INACTIVE' }) =>
      usersApi.update(id, { status: next }),
    onSuccess: (res) => {
      toast.success(res.user.status === 'ACTIVE' ? 'Account activated' : 'Account deactivated', {
        description: `${res.user.firstName} ${res.user.lastName}`,
      });
      setDeactivateTarget(null);
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (err) =>
      toast.error('Update failed', {
        description: err instanceof ApiError ? err.message : 'Unexpected error — try again.',
      }),
  });

  const users = data?.data ?? [];
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
              placeholder="Search name, email or employee ID…"
              className="h-10 pl-9"
              aria-label="Search users"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={role || 'all'} onValueChange={(v) => { setRole(v === 'all' ? '' : (v as Role)); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by role">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status || 'all'} onValueChange={(v) => { setStatus(v === 'all' ? '' : (v as UserStatus)); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-10 sm:h-10" onClick={() => refetch()} aria-label="Refresh users">
              <RefreshCcwIcon className={isRefetching ? 'size-3.5 animate-spin' : 'size-3.5'} /> Refresh
            </Button>
            {isAdmin && (
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => setAddOpen(true)}
              >
                <PlusIcon className="size-4" /> Add user
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {showSkeleton ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={error instanceof Error ? error.message : 'Failed to load users.'} onRetry={() => refetch()} />
        ) : users.length === 0 ? (
          <EmptyState icon={<UsersIcon className="size-5" />} title="No users match" description="Try a different search or clear the filters." />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>User</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-10" aria-label="Actions" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const self = u.id === user.id;
                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <UserAvatar firstName={u.firstName} lastName={u.lastName} />
                              <div>
                                <p className="text-sm font-medium">
                                  {u.firstName} {u.lastName}
                                  {self && <span className="text-muted-foreground ml-1.5 text-xs">(you)</span>}
                                </p>
                                <p className="text-muted-foreground font-mono text-xs">{u.empId}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs">{u.email}</p>
                            <p className="text-muted-foreground text-xs">{u.phone ?? '—'}</p>
                          </TableCell>
                          <TableCell>
                            <RoleBadge role={u.role} />
                          </TableCell>
                          <TableCell className="text-xs">{u.department ?? '—'}</TableCell>
                          <TableCell>
                            <UserStatusBadge status={u.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{fmtDate(u.createdAt)}</TableCell>
                          <TableCell>
                            {isAdmin && !self ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${u.firstName}`}>
                                    <MoreHorizontalIcon className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => setEditing(u)}>
                                    <PencilIcon className="size-4" /> Edit user
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {u.status === 'ACTIVE' ? (
                                    <DropdownMenuItem variant="destructive" onClick={() => setDeactivateTarget(u)}>
                                      <ShieldBanIcon className="size-4" /> Deactivate
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => setStatusMut.mutate({ id: u.id, next: 'ACTIVE' })}>
                                      <ShieldCheckIcon className="size-4" /> Activate
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : isAdmin && self ? (
                              <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                  <span className="text-muted-foreground block px-2 text-xs" tabIndex={0}>
                                    —
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>You cannot edit or deactivate your own account</TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-muted-foreground block px-2 text-xs">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y md:hidden">
                {users.map((u) => {
                  const self = u.id === user.id;
                  return (
                    <div key={u.id} className="flex items-start gap-3 p-4">
                      <UserAvatar firstName={u.firstName} lastName={u.lastName} className="size-10" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-semibold">
                            {u.firstName} {u.lastName}
                          </p>
                          <RoleBadge role={u.role} />
                          <UserStatusBadge status={u.status} />
                        </div>
                        <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                        <p className="text-muted-foreground text-xs">
                          <span className="font-mono">{u.empId}</span>
                          {u.department ? ` · ${u.department}` : ''}
                        </p>
                        {isAdmin && !self && (
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditing(u)}>
                              <PencilIcon className="size-3.5" /> Edit
                            </Button>
                            {u.status === 'ACTIVE' ? (
                              <Button size="sm" variant="outline" className="h-8 border-rose-500/40 text-rose-600 dark:text-rose-400" onClick={() => setDeactivateTarget(u)}>
                                <ShieldBanIcon className="size-3.5" /> Deactivate
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="h-8" onClick={() => setStatusMut.mutate({ id: u.id, next: 'ACTIVE' })}>
                                <ShieldCheckIcon className="size-3.5" /> Activate
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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

      {/* Add dialog */}
      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} />

      {/* Edit dialog */}
      {editing && (
        <EditUserDialog
          target={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}

      {/* Deactivate confirm */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivateTarget?.firstName} {deactivateTarget?.lastName}?</AlertDialogTitle>
            <AlertDialogDescription>
              The account will be signed out and blocked from logging in. Their history and audit entries are kept.
              You can re-activate them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep active</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              disabled={setStatusMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deactivateTarget) setStatusMut.mutate({ id: deactivateTarget.id, next: 'INACTIVE' });
              }}
            >
              Deactivate account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      empId: '',
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'STAFF',
      phone: '',
      department: '',
      office: '',
    },
  });

  const create = useMutation({
    mutationFn: (v: CreateValues) =>
      usersApi.create({
        ...v,
        phone: v.phone || undefined,
        department: v.department || undefined,
        office: v.office || undefined,
      }),
    onSuccess: (res) => {
      toast.success(`User “${res.user.firstName} ${res.user.lastName}” created`, {
        description: `${res.user.role} · ${res.user.email}`,
      });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error('Create failed', {
        description: err instanceof ApiError ? err.message : 'Unexpected error — try again.',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>Create an account and assign a role. The user can sign in immediately.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="empId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. EMP-1024" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          <span className="font-medium">{r.label}</span>
                          <span className="text-muted-foreground block text-[11px]">{r.desc}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="name@ex-ims.dev" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <div className="flex gap-2">
                    <FormControl><Input type="text" placeholder="Min 8 characters" {...field} /></FormControl>
                    <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" aria-label="Generate password" title="Generate password"
                      onClick={() => form.setValue('password', generatePassword(), { shouldValidate: true })}>
                      <Wand2Icon className="size-4" />
                    </Button>
                  </div>
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
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create user'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ target, open, onOpenChange }: { target: SafeUser; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      firstName: target.firstName,
      lastName: target.lastName,
      email: target.email,
      role: target.role,
      phone: target.phone ?? '',
      department: target.department ?? '',
      office: target.office ?? '',
      password: '',
    },
  });

  const update = useMutation({
    mutationFn: (v: EditValues) =>
      usersApi.update(target.id, {
        ...v,
        password: v.password || undefined,
        phone: v.phone || undefined,
        department: v.department || undefined,
        office: v.office || undefined,
      }),
    onSuccess: (res) => {
      toast.success('User updated', { description: `${res.user.firstName} ${res.user.lastName} · ${res.user.role}` });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error('Update failed', {
        description: err instanceof ApiError ? err.message : 'Unexpected error — try again.',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit user · <span className="font-mono text-sm">{target.empId}</span></DialogTitle>
          <DialogDescription>Update details, role or set a new password (leave blank to keep).</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => update.mutate(v))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem><FormLabel>First name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem><FormLabel>Last name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="office" render={({ field }) => (
                <FormItem><FormLabel>Office</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>New password (optional)</FormLabel>
                <div className="flex gap-2">
                  <FormControl><Input type="text" placeholder="Leave blank to keep current" {...field} /></FormControl>
                  <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" aria-label="Generate password" title="Generate password"
                    onClick={() => form.setValue('password', generatePassword(), { shouldValidate: true })}>
                    <Wand2Icon className="size-4" />
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={update.isPending}>
                {update.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
