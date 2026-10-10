import { db } from "@/lib/db";
import { HttpError, type SessionUser } from "@/lib/auth";

/**
 * Append an immutable audit record. Never throws — auditing must not break
 * the primary operation, but failures are surfaced via console.
 */
export async function audit(params: {
  user?: SessionUser | null;
  actorName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.user?.id ?? null,
        actorName:
          params.actorName ??
          (params.user ? `${params.user.firstName} ${params.user.lastName}` : "System"),
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        details: params.details ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record:", params.action, err);
  }
}

export function assert(condition: unknown, status: number, message: string): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
