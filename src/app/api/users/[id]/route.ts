import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import { requirePermission, hashPassword, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { userUpdateSchema } from "@/lib/validators";

export const runtime = "nodejs";

const safeSelect = {
  id: true,
  empId: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  department: true,
  office: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withErrorHandling(async (req: NextRequest, ctx?: Ctx) => {
  const session = await requirePermission("MANAGE_USERS");
  const { id } = await (ctx!.params);
  const body = await req.json().catch(() => ({}));
  const data = userUpdateSchema.parse(body);

  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, "User not found");

  // Guard: admin cannot demote/deactivate own account
  if (id === session.id && (data.status === "INACTIVE" || (data.role && data.role !== "ADMIN"))) {
    throw new HttpError(409, "You cannot change your own role or deactivate your own account");
  }

  if (data.email && data.email !== target.email) {
    const dup = await db.user.findFirst({ where: { email: data.email } });
    if (dup) throw new HttpError(409, "A user with this email already exists");
  }

  const updated = await db.user.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.department !== undefined ? { department: data.department || null } : {}),
      ...(data.office !== undefined ? { office: data.office || null } : {}),
      ...(data.password ? { passwordHash: await hashPassword(data.password) } : {}),
    },
    select: safeSelect,
  });

  await audit({
    user: session,
    action: "USER_UPDATE",
    entity: "USER",
    entityId: id,
    details: `Updated ${updated.firstName} ${updated.lastName} — changed: ${Object.keys(data).filter((k) => k !== "password").join(", ") || "nothing"}${data.password ? ", password" : ""}`,
  });

  return NextResponse.json({ user: updated });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx?: Ctx) => {
  const session = await requirePermission("MANAGE_USERS");
  const { id } = await (ctx!.params);

  if (id === session.id) {
    throw new HttpError(409, "You cannot deactivate your own account");
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, "User not found");

  await db.user.update({ where: { id }, data: { status: "INACTIVE" } });

  await audit({
    user: session,
    action: "USER_DEACTIVATE",
    entity: "USER",
    entityId: id,
    details: `Deactivated account ${target.firstName} ${target.lastName} (${target.empId})`,
  });

  return NextResponse.json({ ok: true });
});
