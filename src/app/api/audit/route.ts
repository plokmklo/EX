import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling, parseIntParam } from "@/lib/api-utils";
import { requirePermission } from "@/lib/auth";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requirePermission("VIEW_AUDIT");
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const entity = url.searchParams.get("entity");
  const action = url.searchParams.get("action");
  const page = parseIntParam(url.searchParams.get("page"), 1);
  const pageSize = parseIntParam(url.searchParams.get("pageSize"), 15, { max: 100 });

  const where = {
    AND: [
      search
        ? {
            OR: [
              { action: { contains: search } },
              { details: { contains: search } },
              { actorName: { contains: search } },
            ],
          }
        : {},
      entity && ["AUTH", "ITEM", "REQUEST", "USER", "CATEGORY", "COMMENT"].includes(entity)
        ? { entity }
        : {},
      action ? { action: { contains: action } } : {},
    ],
  };

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        details: true,
        actorName: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  return NextResponse.json({ data: logs, total, page, pageSize });
});
