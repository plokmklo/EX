import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import { requireAuth, toSafeUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { profileSchema } from "@/lib/validators";

export const runtime = "nodejs";

export const PUT = withErrorHandling(async (req: NextRequest) => {
  const session = await requireAuth();
  const body = await req.json().catch(() => ({}));
  const data = profileSchema.parse(body);

  const updated = await db.user.update({
    where: { id: session.id },
    data: {
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.department !== undefined ? { department: data.department || null } : {}),
      ...(data.office !== undefined ? { office: data.office || null } : {}),
    },
  });

  await audit({
    user: session,
    action: "PROFILE_UPDATE",
    entity: "USER",
    entityId: session.id,
    details: `${session.firstName} ${session.lastName} updated own profile`,
  });

  return NextResponse.json({ user: toSafeUser({ ...updated, role: session.role }) });
});
