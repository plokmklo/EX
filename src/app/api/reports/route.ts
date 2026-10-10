import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling, parseIntParam } from "@/lib/api-utils";
import { requirePermission, HttpError } from "@/lib/auth";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requirePermission("VIEW_REPORTS");
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "valuation";
  const days = parseIntParam(url.searchParams.get("days"), 30, { min: 1, max: 365 });
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  if (type === "valuation") {
    const items = await db.item.findMany({
      where: { isDeleted: false },
      select: { categoryId: true, quantity: true, unitPrice: true },
    });
    const cats = await db.category.findMany({ select: { id: true, name: true } });
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    const byCat = new Map<string, { itemCount: number; totalUnits: number; totalValue: number }>();
    for (const it of items) {
      const e = byCat.get(it.categoryId) ?? { itemCount: 0, totalUnits: 0, totalValue: 0 };
      e.itemCount += 1;
      e.totalUnits += it.quantity;
      e.totalValue += it.quantity * it.unitPrice;
      byCat.set(it.categoryId, e);
    }
    const data = cats
      .map((c) => ({
        categoryId: c.id,
        categoryName: c.name,
        ...(byCat.get(c.id) ?? { itemCount: 0, totalUnits: 0, totalValue: 0 }),
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
    const totals = data.reduce(
      (acc, r) => ({
        itemCount: acc.itemCount + r.itemCount,
        totalUnits: acc.totalUnits + r.totalUnits,
        totalValue: acc.totalValue + r.totalValue,
      }),
      { itemCount: 0, totalUnits: 0, totalValue: 0 }
    );
    return NextResponse.json({
      data,
      totals: {
        ...totals,
        totalItems: totals.itemCount,
        categories: data.length,
      },
    });
  }

  if (type === "movements") {
    const page = parseIntParam(url.searchParams.get("page"), 1);
    const pageSize = parseIntParam(url.searchParams.get("pageSize"), 20, { max: 200 });
    const where = { createdAt: { gte: since } };
    const [total, movements] = await Promise.all([
      db.stockMovement.count({ where }),
      db.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          quantity: true,
          note: true,
          createdAt: true,
          item: { select: { id: true, code: true, name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);
    return NextResponse.json({ data: movements, total, page, pageSize });
  }

  if (type === "requests") {
    const requests = await db.itemRequest.findMany({
      where: { createdAt: { gte: since } },
      select: {
        status: true,
        createdAt: true,
        reviewedAt: true,
        requester: { select: { firstName: true, lastName: true } },
      },
    });
    const byStatus = new Map<string, number>();
    const byDayMap = new Map<string, number>();
    const byRequester = new Map<string, number>();
    let decisionTotalMs = 0;
    let decisionCount = 0;
    for (const r of requests) {
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
      const key = r.createdAt.toISOString().slice(5, 10);
      byDayMap.set(key, (byDayMap.get(key) ?? 0) + 1);
      const name = `${r.requester.firstName} ${r.requester.lastName}`;
      byRequester.set(name, (byRequester.get(name) ?? 0) + 1);
      if (r.reviewedAt) {
        decisionTotalMs += r.reviewedAt.getTime() - r.createdAt.getTime();
        decisionCount += 1;
      }
    }
    const allStatuses = ["PENDING", "APPROVED", "REJECTED", "ISSUED", "RETURNED", "CANCELLED"];
    return NextResponse.json({
      total: requests.length,
      byStatus: allStatuses.map((s) => ({ name: s, count: byStatus.get(s) ?? 0 })),
      byDay: [...byDayMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count })),
      avgDecisionHours: decisionCount ? Number((decisionTotalMs / decisionCount / 3600000).toFixed(1)) : 0,
      topRequesters: [...byRequester.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    });
  }

  throw new HttpError(400, "Unknown report type. Use valuation | movements | requests");
});
