import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import {
  SESSION_COOKIE,
  signSession,
  verifyPassword,
  checkRateLimit,
  clearRateLimit,
  type Role,
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import { loginSchema } from "@/lib/validators";

export const runtime = "nodejs";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const { identifier, password } = loginSchema.parse(body);

  const idKey = identifier.toLowerCase().trim();
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rateKey = `${ip}:${idKey}`;

  const rl = checkRateLimit(rateKey);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil((rl.retryAfterSec ?? 60) / 60)} min.` },
      { status: 429 }
    );
  }

  const user = await db.user.findFirst({
    where: {
      OR: [{ email: idKey }, { empId: identifier.trim() }],
    },
  });

  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !passwordOk) {
    await audit({
      actorName: identifier,
      action: "AUTH_LOGIN_FAILED",
      entity: "AUTH",
      details: `Failed login attempt for "${identifier}"`,
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Account is inactive. Contact your administrator." },
      { status: 403 }
    );
  }

  clearRateLimit(rateKey);

  const { token, maxAge } = signSession({
    sub: user.id,
    role: user.role as Role,
  });

  await audit({
    actorName: `${user.firstName} ${user.lastName}`,
    action: "AUTH_LOGIN",
    entity: "AUTH",
    entityId: user.id,
    details: `${user.firstName} ${user.lastName} signed in`,
  });

  const res = NextResponse.json({
    user: {
      id: user.id,
      empId: user.empId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      department: user.department,
      office: user.office,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return res;
});
