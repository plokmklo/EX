import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import { requireAuth, HttpError } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * QR asset label payload — returns an SVG QR encoding a scannable plain-text
 * payload `EX-IMS|<code>|<name>` plus machine URL for digital devices.
 */
export const GET = withErrorHandling(async (_req: NextRequest, ctx?: Ctx) => {
  await requireAuth();
  const { id } = await (ctx!.params);

  const item = await db.item.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, code: true, name: true },
  });
  if (!item) throw new HttpError(404, "Item not found");

  const payload = `EX-IMS|${item.code}|${item.name}`;
  const svg = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: { dark: "#09090b", light: "#ffffff" },
  });

  return NextResponse.json({
    svg,
    item: { id: item.id, code: item.code, name: item.name },
  });
});
