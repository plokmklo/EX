import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-utils";
import { getSessionUser, toSafeUser } from "@/lib/auth";

export const runtime = "nodejs";

export const GET = withErrorHandling(async () => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ user: toSafeUser(user) });
});
