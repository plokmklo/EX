import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import { requirePermission, requireAuth, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { itemUpdateSchema } from "@/lib/validators";
import {
  itemSelect,
  reservedQtyMap,
  decorateItems,
  assertCategoryExists,
  recordMovement,
} from "@/lib/inventory";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx?: Ctx) => {
  await requireAuth();
  const { id } = await (ctx!.params);

  const item = await db.item.findFirst({
    where: { id, isDeleted: false },
    select: itemSelect,
  });
  if (!item) throw new HttpError(404, "Item not found");

  const [comments, movements, requests, reserved] = await Promise.all([
    db.comment.findMany({
      where: { itemId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        body: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    }),
    db.stockMovement.findMany({
      where: { itemId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        quantity: true,
        note: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    db.itemRequest.findMany({
      where: { itemId: id },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        quantity: true,
        status: true,
        reason: true,
        decisionNote: true,
        createdAt: true,
        requester: {
          select: { id: true, firstName: true, lastName: true, empId: true, email: true },
        },
      },
    }),
    reservedQtyMap([id]),
  ]);

  return NextResponse.json({
    item: decorateItems([item], reserved)[0],
    comments,
    movements,
    requests,
  });
});

export const PUT = withErrorHandling(async (req: NextRequest, ctx?: Ctx) => {
  const session = await requirePermission("MANAGE_ITEMS");
  const { id } = await (ctx!.params);
  const body = await req.json().catch(() => ({}));
  const data = itemUpdateSchema.parse(body);

  const item = await db.item.findFirst({ where: { id, isDeleted: false } });
  if (!item) throw new HttpError(404, "Item not found");

  if (data.categoryId && data.categoryId !== item.categoryId) {
    await assertCategoryExists(data.categoryId);
  }
  if (data.code && data.code.toUpperCase() !== item.code) {
    const dup = await db.item.findUnique({ where: { code: data.code.toUpperCase() } });
    if (dup) throw new HttpError(409, "An item with this code already exists");
  }

  const nextQty = data.quantity ?? item.quantity;
  const nextStatus =
    data.status ?? (nextQty <= 0 ? "OUT_OF_STOCK" : item.status === "DISCONTINUED" || item.status === "MAINTENANCE" ? item.status : "AVAILABLE");

  const updated = await db.item.update({
    where: { id },
    data: {
      ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.brand !== undefined ? { brand: data.brand || null } : {}),
      ...(data.model !== undefined ? { model: data.model || null } : {}),
      ...(data.serial !== undefined ? { serial: data.serial || null } : {}),
      ...(data.unit !== undefined ? { unit: data.unit || "pcs" } : {}),
      ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
      ...(data.minStockLevel !== undefined ? { minStockLevel: data.minStockLevel } : {}),
      ...(data.unitPrice !== undefined ? { unitPrice: data.unitPrice } : {}),
      ...(data.location !== undefined ? { location: data.location || null } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      status: nextStatus,
    },
    select: itemSelect,
  });

  if (data.quantity !== undefined && data.quantity !== item.quantity) {
    await recordMovement({
      itemId: id,
      type: "ADJUST",
      quantity: Math.abs(data.quantity - item.quantity),
      note: `Adjusted from ${item.quantity} to ${data.quantity} ${updated.unit}`,
      userId: session.id,
    });
  }

  const changedFields = Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined);
  await audit({
    user: session,
    action: "ITEM_UPDATE",
    entity: "ITEM",
    entityId: id,
    details: `Updated ${updated.name} (${updated.code}) — changed: ${changedFields.join(", ")}`,
  });

  const reserved = await reservedQtyMap([id]);
  return NextResponse.json({ item: decorateItems([updated], reserved)[0] });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx?: Ctx) => {
  const session = await requirePermission("DELETE_ITEMS");
  const { id } = await (ctx!.params);

  const item = await db.item.findFirst({ where: { id, isDeleted: false } });
  if (!item) throw new HttpError(404, "Item not found");

  const activeRequests = await db.itemRequest.count({
    where: { itemId: id, status: { in: ["PENDING", "APPROVED", "ISSUED"] } },
  });
  if (activeRequests > 0) {
    throw new HttpError(409, `Cannot delete — ${activeRequests} active request(s) reference this item`);
  }

  await db.item.update({ where: { id }, data: { isDeleted: true } });

  await audit({
    user: session,
    action: "ITEM_DELETE",
    entity: "ITEM",
    entityId: id,
    details: `Deleted item ${item.name} (${item.code})`,
  });

  return NextResponse.json({ ok: true });
});
