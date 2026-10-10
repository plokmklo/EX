import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling, parseIntParam } from "@/lib/api-utils";
import { requirePermission, HttpError } from "@/lib/auth";

export const runtime = "nodejs";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requirePermission("VIEW_REPORTS");
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "inventory";
  const days = parseIntParam(url.searchParams.get("days"), 30, { min: 1, max: 365 });

  let filename: string;
  let csv: string;

  if (type === "inventory") {
    const items = await db.item.findMany({
      where: { isDeleted: false },
      orderBy: { code: "asc" },
      select: {
        code: true,
        name: true,
        category: { select: { name: true } },
        brand: true,
        model: true,
        serial: true,
        unit: true,
        quantity: true,
        minStockLevel: true,
        unitPrice: true,
        status: true,
        location: true,
        updatedAt: true,
      },
    });
    filename = `ex-ims-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    csv = toCsv(
      ["Code", "Name", "Category", "Brand", "Model", "Serial", "Unit", "Quantity", "MinStock", "UnitPrice", "StockValue", "Status", "Location", "UpdatedAt"],
      items.map((i) => [
        i.code, i.name, i.category.name, i.brand ?? "", i.model ?? "", i.serial ?? "",
        i.unit, i.quantity, i.minStockLevel, i.unitPrice, (i.quantity * i.unitPrice).toFixed(2),
        i.status, i.location ?? "", i.updatedAt.toISOString(),
      ])
    );
  } else if (type === "movements") {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const movements = await db.stockMovement.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      select: {
        type: true,
        quantity: true,
        note: true,
        createdAt: true,
        item: { select: { code: true, name: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });
    filename = `ex-ims-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    csv = toCsv(
      ["Date", "Type", "ItemCode", "ItemName", "Quantity", "User", "Note"],
      movements.map((m) => [
        m.createdAt.toISOString(), m.type, m.item.code, m.item.name, m.quantity,
        m.user ? `${m.user.firstName} ${m.user.lastName}` : "System", m.note ?? "",
      ])
    );
  } else if (type === "requests") {
    const requests = await db.itemRequest.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        quantity: true,
        reason: true,
        decisionNote: true,
        createdAt: true,
        issuedAt: true,
        returnedAt: true,
        item: { select: { code: true, name: true } },
        requester: { select: { firstName: true, lastName: true, empId: true } },
        reviewer: { select: { firstName: true, lastName: true } },
      },
    });
    filename = `ex-ims-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    csv = toCsv(
      ["Date", "ItemCode", "ItemName", "Quantity", "Requester", "EmpId", "Status", "Reviewer", "Reason", "DecisionNote", "IssuedAt", "ReturnedAt"],
      requests.map((r) => [
        r.createdAt.toISOString(), r.item.code, r.item.name, r.quantity,
        `${r.requester.firstName} ${r.requester.lastName}`, r.requester.empId, r.status,
        r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : "",
        r.reason ?? "", r.decisionNote ?? "",
        r.issuedAt?.toISOString() ?? "", r.returnedAt?.toISOString() ?? "",
      ])
    );
  } else {
    throw new HttpError(400, "Unknown export type. Use inventory | movements | requests");
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
