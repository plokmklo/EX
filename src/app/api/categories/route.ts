import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import { requireAuth, requirePermission, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { categorySchema } from "@/lib/validators";

export const runtime = "nodejs";

export const GET = withErrorHandling(async () => {
  await requireAuth();
  const categories = await db.category.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      _count: { select: { items: { where: { isDeleted: false } } } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    data: categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      itemCount: c._count.items,
      createdAt: c.createdAt,
    })),
  });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requirePermission("MANAGE_CATEGORIES");
  const body = await req.json().catch(() => ({}));
  const data = categorySchema.parse(body);

  const name = data.name;
  const dup = await db.category.findUnique({ where: { name } });
  if (dup) throw new HttpError(409, "A category with this name already exists");

  const created = await db.category.create({
    data: { name, description: data.description || null },
  });

  await audit({
    user: session,
    action: "CATEGORY_CREATE",
    entity: "CATEGORY",
    entityId: created.id,
    details: `Created category "${created.name}"`,
  });

  return NextResponse.json(
    { category: { ...created, itemCount: 0 } },
    { status: 201 }
  );
});
