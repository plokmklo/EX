import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";

function dayKey(d: Date): string {
  return d.toISOString().slice(5, 10); // MM-DD
}

export const GET = withErrorHandling(async () => {
  const session = await requireAuth();
  const isStaff = session.role === "STAFF";

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    totalItems,
    unitAgg,
    lowStockCount,
    outOfStockCount,
    pendingRequests,
    activeLoans,
    usersCount,
    requestsThisMonth,
    categories,
    statusGroups,
    movements7d,
    topRequested,
    recentActivity,
    myPending,
  ] = await Promise.all([
    db.item.count({ where: { isDeleted: false } }),
    db.item.aggregate({
      where: { isDeleted: false },
      _sum: { quantity: true, unitPrice: true },
    }),
    db.item.count({ where: { isDeleted: false, quantity: { gt: 0 } } }),
    db.item.count({ where: { isDeleted: false, quantity: { lte: 0 } } }),
    db.itemRequest.count({ where: { status: "PENDING" } }),
    db.itemRequest.count({ where: { status: "ISSUED" } }),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.itemRequest.count({ where: { createdAt: { gte: monthStart } } }),
    db.item.groupBy({
      by: ["categoryId"],
      where: { isDeleted: false },
      _count: { id: true },
      _sum: { quantity: true },
    }),
    db.item.groupBy({
      by: ["status"],
      where: { isDeleted: false },
      _count: { id: true },
    }),
    db.stockMovement.findMany({
      where: { createdAt: { gte: weekAgo }, type: { in: ["IN", "OUT"] } },
      select: { type: true, quantity: true, createdAt: true },
    }),
    db.itemRequest.groupBy({
      by: ["itemId"],
      _count: { id: true },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        details: true,
        actorName: true,
        createdAt: true,
      },
    }),
    isStaff
      ? db.itemRequest.count({ where: { status: "PENDING", requesterId: session.id } })
      : Promise.resolve(0),
  ]);

  // inventory value: sum(quantity * unitPrice) — computed in SQL-free way via group
  const valueAgg = await db.item.findMany({
    where: { isDeleted: false },
    select: { quantity: true, unitPrice: true },
  });
  const inventoryValue = valueAgg.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  // category names
  const catIds = categories.map((c) => c.categoryId);
  const cats = await db.category.findMany({
    where: { id: { in: catIds } },
    select: { id: true, name: true },
  });
  const catName = new Map(cats.map((c) => [c.id, c.name]));

  // category breakdown with value
  const catItems = await db.item.findMany({
    where: { isDeleted: false },
    select: { categoryId: true, quantity: true, unitPrice: true },
  });
  const catValue = new Map<string, { itemCount: number; totalUnits: number; totalValue: number }>();
  for (const it of catItems) {
    const entry = catValue.get(it.categoryId) ?? { itemCount: 0, totalUnits: 0, totalValue: 0 };
    entry.itemCount += 1;
    entry.totalUnits += it.quantity;
    entry.totalValue += it.quantity * it.unitPrice;
    catValue.set(it.categoryId, entry);
  }
  const categoryBreakdown = cats
    .map((c) => ({
      name: c.name,
      itemCount: catValue.get(c.id)?.itemCount ?? 0,
      totalValue: catValue.get(c.id)?.totalValue ?? 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  // movements per day
  const byDay = new Map<string, { in: number; out: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    byDay.set(dayKey(d), { in: 0, out: 0 });
  }
  for (const m of movements7d) {
    const k = dayKey(m.createdAt);
    const e = byDay.get(k);
    if (e) {
      if (m.type === "IN") e.in += m.quantity;
      else e.out += m.quantity;
    }
  }
  const movements7dSeries = [...byDay.entries()].map(([date, v]) => ({ date, ...v }));

  // top requested items
  const topItemIds = topRequested.sort((a, b) => b._count.id - a._count.id).slice(0, 5);
  const topItems = await db.item.findMany({
    where: { id: { in: topItemIds.map((t) => t.itemId) } },
    select: { id: true, name: true },
  });
  const topName = new Map(topItems.map((t) => [t.id, t.name]));
  const topRequestedSeries = topItemIds
    .map((t) => ({ name: topName.get(t.itemId) ?? "Unknown", requestCount: t._count.id }))
    .filter((t) => t.name !== "Unknown");

  // correct low-stock: quantity > 0 && quantity <= minStockLevel
  const lowStockProper = await db.item.count({
    where: { isDeleted: false, quantity: { gt: 0, lte: db.item.fields.minStockLevel } },
  });

  return NextResponse.json({
    kpis: {
      totalItems,
      totalUnits: unitAgg._sum.quantity ?? 0,
      inventoryValue,
      lowStockCount: lowStockProper,
      outOfStockCount: outOfStockCount,
      pendingRequests,
      activeLoans,
      usersCount,
      requestsThisMonth,
      myPending,
    },
    categoryBreakdown,
    statusBreakdown: statusGroups.map((s) => ({ name: s.status, itemCount: s._count.id })),
    movements7d: movements7dSeries,
    topRequested: topRequestedSeries,
    recentActivity,
  });
});
