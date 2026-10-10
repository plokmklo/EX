import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling, parseIntParam } from "@/lib/api-utils";
import { requireAuth, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { requestCreateSchema } from "@/lib/validators";
import { reservedQtyMap } from "@/lib/inventory";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const itemId = url.searchParams.get("itemId");
  const mine = url.searchParams.get("mine") === "1" || session.role === "STAFF";
  const page = parseIntParam(url.searchParams.get("page"), 1);
  const pageSize = parseIntParam(url.searchParams.get("pageSize"), 10, { max: 200 });

  const where = {
    AND: [
      status && ["PENDING", "APPROVED", "REJECTED", "ISSUED", "RETURNED", "CANCELLED"].includes(status)
        ? { status }
        : {},
      itemId ? { itemId } : {},
      mine ? { requesterId: session.id } : {},
    ],
  };

  const [total, requests] = await Promise.all([
    db.itemRequest.count({ where }),
    db.itemRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        quantity: true,
        reason: true,
        status: true,
        reviewedAt: true,
        decisionNote: true,
        issuedAt: true,
        returnedAt: true,
        createdAt: true,
        itemId: true,
        item: { select: { id: true, code: true, name: true, unit: true, quantity: true } },
        requester: {
          select: { id: true, firstName: true, lastName: true, empId: true, email: true },
        },
        reviewer: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  // compute availableQty per item for the requesting UI
  const reserved = await reservedQtyMap([...new Set(requests.map((r) => r.itemId))]);
  const data = requests.map((r) => ({
    ...r,
    item: {
      ...r.item,
      availableQty: Math.max(0, r.item.quantity - (reserved.get(r.itemId) ?? 0)),
    },
  }));

  return NextResponse.json({ data, total, page, pageSize });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth();
  const body = await req.json().catch(() => ({}));
  const data = requestCreateSchema.parse(body);

  const item = await db.item.findFirst({ where: { id: data.itemId, isDeleted: false } });
  if (!item) throw new HttpError(404, "Item not found");
  if (item.status === "DISCONTINUED") {
    throw new HttpError(409, "This item is discontinued and cannot be requested");
  }

  // NOTE: requests may exceed available stock — those are treated as
  // procurement/restock signals and remain PENDING until stock arrives
  // (approval re-validates availability; issue enforces it transactionally).

  // prevent duplicate identical pending request by same user
  const dup = await db.itemRequest.findFirst({
    where: { itemId: item.id, requesterId: session.id, status: "PENDING" },
  });
  if (dup) {
    throw new HttpError(409, "You already have a pending request for this item");
  }

  const created = await db.itemRequest.create({
    data: {
      itemId: item.id,
      requesterId: session.id,
      quantity: data.quantity,
      reason: data.reason || null,
      status: "PENDING",
    },
  });

  const reserved = (await reservedQtyMap([item.id])).get(item.id) ?? 0;
  const availableQty = Math.max(0, item.quantity - reserved);
  const isRestockSignal = data.quantity > availableQty;

  await audit({
    user: session,
    action: "REQUEST_CREATE",
    entity: "REQUEST",
    entityId: created.id,
    details: `${session.firstName} ${session.lastName} requested ${data.quantity} ${item.unit} of ${item.name} (${item.code})${isRestockSignal ? ` — procurement signal (${availableQty} available)` : ""}`,
  });

  return NextResponse.json({ request: { ...created, requester: session } }, { status: 201 });
});
