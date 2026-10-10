import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Derived notification feed (stateless — computed from live data):
 *  - STAFF: own requests with recent status changes (7d)
 *  - STOREKEEPER/ADMIN/MANAGER: pending requests, low-stock and out-of-stock alerts
 */
export const GET = withErrorHandling(async () => {
  const session = await requireAuth();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  interface NotificationDto {
    id: string;
    type: "REQUEST_UPDATE" | "REQUEST_PENDING" | "LOW_STOCK" | "OUT_OF_STOCK";
    title: string;
    body: string;
    createdAt: string;
    targetView: "requests" | "inventory";
  }

  const notifications: NotificationDto[] = [];

  if (session.role === "STAFF") {
    const mine = await db.itemRequest.findMany({
      where: {
        requesterId: session.id,
        status: { in: ["APPROVED", "REJECTED", "ISSUED", "RETURNED"] },
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        quantity: true,
        updatedAt: true,
        item: { select: { name: true, code: true } },
      },
    });
    for (const r of mine) {
      const verb =
        r.status === "APPROVED"
          ? "approved — ready for pickup"
          : r.status === "REJECTED"
            ? "rejected"
            : r.status === "ISSUED"
              ? "issued to you"
              : "marked returned";
      notifications.push({
        id: `req-${r.id}`,
        type: "REQUEST_UPDATE",
        title: `Request ${verb}`,
        body: `${r.quantity} × ${r.item.name} (${r.item.code})`,
        createdAt: r.updatedAt.toISOString(),
        targetView: "requests",
      });
    }
  } else {
    const pending = await db.itemRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        quantity: true,
        createdAt: true,
        requester: { select: { firstName: true, lastName: true } },
        item: { select: { name: true, code: true } },
      },
    });
    for (const r of pending) {
      notifications.push({
        id: `pending-${r.id}`,
        type: "REQUEST_PENDING",
        title: "New request awaiting review",
        body: `${r.requester.firstName} ${r.requester.lastName} → ${r.quantity} × ${r.item.name}`,
        createdAt: r.createdAt.toISOString(),
        targetView: "requests",
      });
    }

    const lowStock = await db.item.findMany({
      where: { isDeleted: false, quantity: { gt: 0, lte: db.item.fields.minStockLevel } },
      orderBy: { quantity: "asc" },
      take: 6,
      select: { id: true, name: true, code: true, quantity: true, minStockLevel: true, updatedAt: true },
    });
    for (const it of lowStock) {
      notifications.push({
        id: `low-${it.id}`,
        type: "LOW_STOCK",
        title: "Low stock warning",
        body: `${it.name} (${it.code}) — ${it.quantity} left, min ${it.minStockLevel}`,
        createdAt: it.updatedAt.toISOString(),
        targetView: "inventory",
      });
    }

    const outOfStock = await db.item.findMany({
      where: { isDeleted: false, quantity: { lte: 0 }, status: { not: "DISCONTINUED" } },
      take: 6,
      select: { id: true, name: true, code: true, updatedAt: true },
    });
    for (const it of outOfStock) {
      notifications.push({
        id: `out-${it.id}`,
        type: "OUT_OF_STOCK",
        title: "Out of stock",
        body: `${it.name} (${it.code}) — replenishment required`,
        createdAt: it.updatedAt.toISOString(),
        targetView: "inventory",
      });
    }
  }

  notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ data: notifications.slice(0, 15), total: notifications.length });
});
