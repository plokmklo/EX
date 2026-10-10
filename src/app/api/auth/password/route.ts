import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import { requireAuth, hashPassword, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { passwordChangeSchema } from "@/lib/validators";

export const runtime = "nodejs";

export const PUT = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth();
  const body = await req.json().catch(() => ({}));
  const { currentPassword, newPassword } = passwordChangeSchema.parse(body);

  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  await audit({
    user: session,
    action: "PASSWORD_CHANGE",
    entity: "USER",
    entityId: session.id,
    details: `${session.firstName} ${session.lastName} changed own password`,
  });

  return NextResponse.json({ ok: true });
});
