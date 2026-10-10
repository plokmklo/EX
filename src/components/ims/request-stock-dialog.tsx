'use client';

/**
 * Request-stock dialog: quantity + reason → POST /api/requests.
 */
import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2Icon } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { requestsApi, ApiError } from '@/lib/ims-client';
import type { ItemDto } from '@/types/ims';

const schema = z.object({
  quantity: z.coerce.number<number>().int('Whole numbers only').min(1, 'Minimum 1'),
  reason: z.string().max(500).optional().or(z.literal('')),
});

type Values = z.infer<typeof schema>;

export function RequestStockDialog({
  item,
  open,
  onOpenChange,
}: {
  item: ItemDto | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1, reason: '' },
  });

  React.useEffect(() => {
    if (open) form.reset({ quantity: 1, reason: '' });
  }, [open, form]);

  const create = useMutation({
    mutationFn: (v: Values) => requestsApi.create({ itemId: item!.id, quantity: v.quantity, reason: v.reason || undefined }),
    onSuccess: () => {
      toast.success('Request submitted for approval', {
        description: 'You will be notified when a manager reviews it.',
      });
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['items'] });
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error('Request failed', {
        description: err instanceof ApiError ? err.message : 'Unexpected error — try again.',
      }),
  });

  const available = item?.availableQty ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request stock</DialogTitle>
          <DialogDescription>
            {item ? `${item.name} (${item.code}) — ${available} ${item.unit} available` : ''}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={100000} step={1} {...field} />
                  </FormControl>
                  <FormMessage />
                  {available === 0 ? (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      Out of stock — your request will be routed to the store team as a procurement signal.
                    </p>
                  ) : field.value > available ? (
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      Exceeds the {available} {item?.unit} available — the store team will treat this as a restock request.
                    </p>
                  ) : null}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="e.g. Restocking computer lab consumables" {...field} className="resize-none" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={create.isPending}>
                {create.isPending && <Loader2Icon className="size-4 animate-spin" />}
                Submit request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
