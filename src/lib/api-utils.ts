import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/auth";

export type ApiHandler = (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps an API route handler with uniform error handling:
 * HttpError -> status/message; ZodError -> 400; unknown -> 500.
 */
export function withErrorHandling(handler: ApiHandler): ApiHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const first = err.issues?.[0];
        const field = first?.path?.join(".");
        return NextResponse.json(
          { error: field ? `${field}: ${first.message}` : "Invalid input" },
          { status: 400 }
        );
      }
      console.error("[api] unhandled error:", req.method, req.url, err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export function parseIntParam(
  value: string | null,
  fallback: number,
  { min = 1, max = 500 }: { min?: number; max?: number } = {}
): number {
  const n = parseInt(value ?? "", 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
