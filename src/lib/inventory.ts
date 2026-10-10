import { db } from "@/lib/db";
import { HttpError } from "@/lib/auth";

/** Prisma select for Item including category relation. */
export const itemInclude = {
  category: { select: { id: true, name: true } },
} as const;

/** Base item select matching ItemDto shape. */
export const itemSelect = {
  id: true,
  code: true,
  name: true,
  categoryId: true,
  category: { select: { id: true, name: true } },
  brand: true,
  model: true,
  serial: true,
  unit: true,
  quantity: true,
  minStockLevel: true,
  unitPrice: true,
  location: true,
  description: true,
  status: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Compute reserved quantities per item from APPROVED (not yet issued) requests.
 * Returns Map<itemId, reservedQty>.
 */
export async function reservedQtyMap(itemIds: string[]): Promise<Map<string, number>> {
  if (itemIds.length === 0) return new Map();
  const reserved = await db.itemRequest.groupBy({
    by: ["itemId"],
    where: { itemId: { in: itemIds }, status: "APPROVED" },
    _sum: { quantity: true },
  });
  return new Map(reserved.map((r) => [r.itemId, r._sum.quantity ?? 0]));
}

/** Attach reservedQty/availableQty to raw item rows. */
export function decorateItems<T extends { id: string; quantity: number }>(
  items: T[],
  reserved: Map<string, number>
) {
  return items.map((it) => {
    const reservedQty = Math.min(reserved.get(it.id) ?? 0, it.quantity);
    return { ...it, reservedQty, availableQty: Math.max(0, it.quantity - reservedQty) };
  });
}

/** Verify a category exists, else 400. */
export async function assertCategoryExists(categoryId: string) {
  const cat = await db.category.findUnique({ where: { id: categoryId } });
  if (!cat) throw new HttpError(400, "Selected category does not exist");
  return cat;
}

/** Record a stock movement + audit-safe. */
export async function recordMovement(params: {
  itemId: string;
  type: "IN" | "OUT" | "ADJUST";
  quantity: number;
  reference?: string | null;
  note?: string | null;
  userId?: string | null;
}) {
  await db.stockMovement.create({
    data: {
      itemId: params.itemId,
      type: params.type,
      quantity: params.quantity,
      reference: params.reference ?? null,
      note: params.note ?? null,
      userId: params.userId ?? null,
    },
  });
}
