'use client';

/**
 * Add / Edit item dialog with react-hook-form + zod, inline new-category creation.
 */
import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2Icon, PlusIcon, ShuffleIcon } from 'lucide-react';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { categoriesApi, itemsApi, ApiError } from '@/lib/ims-client';
import type { ItemDto } from '@/types/ims';

const UNITS = ['pcs', 'box', 'kg', 'L', 'set'] as const;

const formSchema = z.object({
  code: z.string().min(2, 'Code is required').max(32, 'Max 32 characters'),
  name: z.string().min(2, 'Name is required').max(120),
  categoryId: z.string().min(1, 'Choose a category'),
  quantity: z.coerce.number<number>().int('Whole numbers only').min(0, 'Must be ≥ 0'),
  unit: z.string().min(1, 'Unit is required'),
  minStockLevel: z.coerce.number<number>().int().min(0),
  unitPrice: z.coerce.number<number>().min(0),
  brand: z.string().max(80).optional().or(z.literal('')),
  model: z.string().max(80).optional().or(z.literal('')),
  serial: z.string().max(80).optional().or(z.literal('')),
  location: z.string().max(120).optional().or(z.literal('')),
  description: z.string().max(1000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

export function suggestCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `ITM-${s}`;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ItemDto | null;
  canManage: boolean;
}

export function ItemFormDialog({ open, onOpenChange, editing }: Props) {
  const qc = useQueryClient();
  const [newCatOpen, setNewCatOpen] = React.useState(false);
  const [newCatName, setNewCatName] = React.useState('');
  const [newCatDesc, setNewCatDesc] = React.useState('');

  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: '',
      name: '',
      categoryId: '',
      quantity: 0,
      unit: 'pcs',
      minStockLevel: 5,
      unitPrice: 0,
      brand: '',
      model: '',
      serial: '',
      location: '',
      description: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      if (editing) {
        form.reset({
          code: editing.code,
          name: editing.name,
          categoryId: editing.categoryId,
          quantity: editing.quantity,
          unit: editing.unit,
          minStockLevel: editing.minStockLevel,
          unitPrice: editing.unitPrice,
          brand: editing.brand ?? '',
          model: editing.model ?? '',
          serial: editing.serial ?? '',
          location: editing.location ?? '',
          description: editing.description ?? '',
        });
      } else {
        form.reset({
          code: suggestCode(),
          name: '',
          categoryId: '',
          quantity: 0,
          unit: 'pcs',
          minStockLevel: 5,
          unitPrice: 0,
          brand: '',
          model: '',
          serial: '',
          location: '',
          description: '',
        });
      }
    }
  }, [open, editing, form]);

  const createCategory = useMutation({
    mutationFn: () => categoriesApi.create({ name: newCatName.trim(), description: newCatDesc.trim() || undefined }),
    onSuccess: (res) => {
      toast.success(`Category “${res.category.name}” created`);
      qc.invalidateQueries({ queryKey: ['categories'] });
      form.setValue('categoryId', res.category.id, { shouldValidate: true });
      setNewCatOpen(false);
      setNewCatName('');
      setNewCatDesc('');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Failed to create category'),
  });

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const body = {
        ...values,
        brand: values.brand || undefined,
        model: values.model || undefined,
        serial: values.serial || undefined,
        location: values.location || undefined,
        description: values.description || undefined,
      };
      return editing ? itemsApi.update(editing.id, body) : itemsApi.create(body);
    },
    onSuccess: (res) => {
      toast.success(editing ? 'Item updated' : `Item “${res.item.name}” created`, {
        description: editing ? `${res.item.code} · qty ${res.item.quantity} ${res.item.unit}` : 'Added to the catalogue.',
      });
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['item', editing?.id] });
      qc.invalidateQueries({ queryKey: ['audit'] });
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error(editing ? 'Update failed' : 'Create failed', {
        description: err instanceof ApiError ? err.message : 'Unexpected error — try again.',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit item · ${editing.code}` : 'Add new item'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update catalogue fields. Quantity changes are recorded as ADJUST movements.'
              : 'Register a new item in the store catalogue.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item code</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="ITM-XXXX" {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-9 shrink-0"
                        onClick={() => form.setValue('code', suggestCode(), { shouldValidate: true })}
                        aria-label="Suggest a new code"
                        title="Suggest code"
                      >
                        <ShuffleIcon className="size-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Laser Printer Toner" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <div className="flex gap-2">
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(cats?.data ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Popover open={newCatOpen} onOpenChange={setNewCatOpen}>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" aria-label="New category">
                            <PlusIcon className="size-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-72 space-y-2.5">
                          <p className="text-sm font-semibold">New category</p>
                          <Input
                            placeholder="Category name"
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                          />
                          <Input
                            placeholder="Description (optional)"
                            value={newCatDesc}
                            onChange={(e) => setNewCatDesc(e.target.value)}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={!newCatName.trim() || createCategory.isPending}
                            onClick={() => createCategory.mutate()}
                          >
                            {createCategory.isPending && <Loader2Icon className="size-3.5 animate-spin" />} Create
                          </Button>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minStockLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min stock level</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit price (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Main store · Shelf B4" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Optional notes about this item" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={save.isPending}>
                {save.isPending && <Loader2Icon className="size-4 animate-spin" />}
                {editing ? 'Save changes' : 'Create item'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
