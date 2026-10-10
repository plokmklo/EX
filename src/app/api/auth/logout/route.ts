import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-utils";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export const POST = withErrorHandling(async () => {
  const user = await getSessionUser();
  if (user) {
    await audit({
      user,
      action: "AUTH_LOGOUT",
      entity: "AUTH",
      entityId: user.id,
      details: `${user.firstName} ${user.lastName} signed out`,
    });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
});
