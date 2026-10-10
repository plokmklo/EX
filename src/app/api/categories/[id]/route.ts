import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import { requirePermission, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { categorySchema } from "@/lib/validators";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withErrorHandling(async (req: NextRequest, ctx?: Ctx) => {
  const session = await requirePermission("MANAGE_CATEGORIES");
  const { id } = await (ctx!.params);
  const body = await req.json().catch(() => ({}));
  const data = categorySchema.partial().parse(body);

  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Category not found");

  if (data.name && data.name !== existing.name) {
    const dup = await db.category.findUnique({ where: { name: data.name } });
    if (dup) throw new HttpError(409, "A category with this name already exists");
  }

  const updated = await db.category.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
    },
  });

  await audit({
    user: session,
    action: "CATEGORY_UPDATE",
    entity: "CATEGORY",
    entityId: id,
    details: `Updated category "${updated.name}"`,
  });

  return NextResponse.json({ category: updated });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx?: Ctx) => {
  const session = await requirePermission("MANAGE_ITEMS");
  const { id } = await (ctx!.params);

  const existing = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });
  if (!existing) throw new HttpError(404, "Category not found");
  if (existing._count.items > 0) {
    throw new HttpError(409, `Cannot delete — ${existing._count.items} item(s) reference this category`);
  }

  await db.category.delete({ where: { id } });

  await audit({
    user: session,
    action: "CATEGORY_DELETE",
    entity: "CATEGORY",
    entityId: id,
    details: `Deleted category "${existing.name}"`,
  });

  return NextResponse.json({ ok: true });
});
