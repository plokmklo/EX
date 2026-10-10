import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import { requireAuth, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { commentSchema } from "@/lib/validators";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_req: NextRequest, ctx?: Ctx) => {
  await requireAuth();
  const { id } = await (ctx!.params);
  const comments = await db.comment.findMany({
    where: { itemId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });
  return NextResponse.json({ data: comments });
});

export const POST = withErrorHandling(async (req: NextRequest, ctx?: Ctx) => {
  const session = await requireAuth();
  const { id } = await (ctx!.params);
  const body = await req.json().catch(() => ({}));
  const { body: text } = commentSchema.parse(body);

  const item = await db.item.findFirst({ where: { id, isDeleted: false } });
  if (!item) throw new HttpError(404, "Item not found");

  const created = await db.comment.create({
    data: { itemId: id, userId: session.id, body: text },
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });

  await audit({
    user: session,
    action: "COMMENT_CREATE",
    entity: "ITEM",
    entityId: id,
    details: `Commented on ${item.name} (${item.code})`,
  });

  return NextResponse.json({ comment: created }, { status: 201 });
});
