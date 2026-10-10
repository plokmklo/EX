import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling, parseIntParam } from "@/lib/api-utils";
import { requirePermission, requireAuth, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { itemCreateSchema } from "@/lib/validators";
import {
  itemSelect,
  reservedQtyMap,
  decorateItems,
  assertCategoryExists,
  recordMovement,
} from "@/lib/inventory";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireAuth();
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const categoryId = url.searchParams.get("categoryId");
  const status = url.searchParams.get("status");
  const lowStock = url.searchParams.get("lowStock") === "1";
  const sortParam = url.searchParams.get("sort") ?? "createdAt";
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
  const page = parseIntParam(url.searchParams.get("page"), 1);
  const pageSize = parseIntParam(url.searchParams.get("pageSize"), 10, { max: 200 });

  const validSorts = ["name", "quantity", "unitPrice", "createdAt", "updatedAt", "code"];
  const sort = validSorts.includes(sortParam) ? sortParam : "createdAt";

  const where = {
    AND: [
      { isDeleted: false },
      search
        ? {
            OR: [
              { name: { contains: search } },
              { code: { contains: search } },
              { brand: { contains: search } },
              { model: { contains: search } },
              { serial: { contains: search } },
            ],
          }
        : {},
      categoryId ? { categoryId } : {},
      status && ["AVAILABLE", "OUT_OF_STOCK", "MAINTENANCE", "DISCONTINUED"].includes(status)
        ? { status }
        : {},
      lowStock
        ? {
            OR: [
              { quantity: { lte: 0 } },
              { quantity: { lte: db.item.fields.minStockLevel } },
            ],
          }
        : {},
    ],
  };

  const [total, items] = await Promise.all([
    db.item.count({ where }),
    db.item.findMany({
      where,
      select: itemSelect,
      orderBy: { [sort]: order },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const reserved = await reservedQtyMap(items.map((i) => i.id));
  return NextResponse.json({
    data: decorateItems(items, reserved),
    total,
    page,
    pageSize,
  });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requirePermission("MANAGE_ITEMS");
  const body = await req.json().catch(() => ({}));
  const data = itemCreateSchema.parse(body);

  await assertCategoryExists(data.categoryId);

  const code = data.code.toUpperCase();
  const dup = await db.item.findUnique({ where: { code } });
  if (dup) throw new HttpError(409, "An item with this code already exists");

  const status =
    data.status ??
    (data.quantity <= 0 ? "OUT_OF_STOCK" : "AVAILABLE");

  const created = await db.item.create({
    data: {
      code,
      name: data.name,
      categoryId: data.categoryId,
      brand: data.brand || null,
      model: data.model || null,
      serial: data.serial || null,
      unit: data.unit || "pcs",
      quantity: data.quantity,
      minStockLevel: data.minStockLevel ?? 5,
      unitPrice: data.unitPrice ?? 0,
      location: data.location || null,
      description: data.description || null,
      status,
      createdById: session.id,
    },
    select: itemSelect,
  });

  if (data.quantity > 0) {
    await recordMovement({
      itemId: created.id,
      type: "IN",
      quantity: data.quantity,
      reference: "INITIAL",
      note: "Initial stock on item creation",
      userId: session.id,
    });
  }

  await audit({
    user: session,
    action: "ITEM_CREATE",
    entity: "ITEM",
    entityId: created.id,
    details: `Created item ${created.name} (${created.code}) with ${created.quantity} ${created.unit}`,
  });

  const reserved = await reservedQtyMap([created.id]);
  return NextResponse.json({ item: decorateItems([created], reserved)[0] }, { status: 201 });
});
