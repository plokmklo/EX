import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling } from "@/lib/api-utils";
import { requireAuth, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { requestActionSchema } from "@/lib/validators";
import { recordMovement } from "@/lib/inventory";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const requestSelect = {
  id: true,
  quantity: true,
  reason: true,
  status: true,
  reviewedAt: true,
  decisionNote: true,
  issuedAt: true,
  returnedAt: true,
  createdAt: true,
  itemId: true,
  item: { select: { id: true, code: true, name: true, unit: true, quantity: true } },
  requester: {
    select: { id: true, firstName: true, lastName: true, empId: true, email: true },
  },
  reviewer: { select: { id: true, firstName: true, lastName: true } },
} as const;

export const PUT = withErrorHandling(async (req: NextRequest, ctx?: Ctx) => {
  const session = await requireAuth();
  const { id } = await (ctx!.params);
  const body = await req.json().catch(() => ({}));
  const { action, note } = requestActionSchema.parse(body);

  const request = await db.itemRequest.findUnique({
    where: { id },
    include: {
      item: true,
      requester: {
        select: { id: true, firstName: true, lastName: true, empId: true, email: true },
      },
    },
  });
  if (!request) throw new HttpError(404, "Request not found");

  const role = session.role;
  const isStoreSide = role === "ADMIN" || role === "STOREKEEPER";
  const isReviewer = role === "ADMIN" || role === "MANAGER" || role === "STOREKEEPER";
  const isRequester = request.requesterId === session.id;

  let updated;
  let auditAction = "";
  let auditDetails = "";

  switch (action) {
    case "approve": {
      if (!isReviewer) throw new HttpError(403, "Only managers, storekeepers or admins can approve");
      if (request.status !== "PENDING") throw new HttpError(409, `Cannot approve a ${request.status} request`);
      // re-validate availability at approval time
      const approvedReserved = await db.itemRequest.aggregate({
        where: { itemId: request.itemId, status: "APPROVED", id: { not: request.id } },
        _sum: { quantity: true },
      });
      const available = request.item.quantity - (approvedReserved._sum.quantity ?? 0);
      if (request.quantity > available) {
        throw new HttpError(
          409,
          `Insufficient stock to approve: ${available} ${request.item.unit} available, ${request.quantity} requested`
        );
      }
      updated = await db.itemRequest.update({
        where: { id },
        data: { status: "APPROVED", reviewerId: session.id, reviewedAt: new Date(), decisionNote: note || null },
        select: requestSelect,
      });
      auditAction = "REQUEST_APPROVE";
      auditDetails = `Approved request #${id.slice(-6)} for ${request.quantity} ${request.item.unit} of ${request.item.name} (${request.requester.firstName} ${request.requester.lastName})`;
      break;
    }
    case "reject": {
      if (!isReviewer) throw new HttpError(403, "Only managers, storekeepers or admins can reject");
      if (request.status !== "PENDING") throw new HttpError(409, `Cannot reject a ${request.status} request`);
      updated = await db.itemRequest.update({
        where: { id },
        data: { status: "REJECTED", reviewerId: session.id, reviewedAt: new Date(), decisionNote: note || null },
        select: requestSelect,
      });
      auditAction = "REQUEST_REJECT";
      auditDetails = `Rejected request for ${request.quantity} ${request.item.unit} of ${request.item.name}${note ? ` — "${note}"` : ""}`;
      break;
    }
    case "issue": {
      if (!isStoreSide) throw new HttpError(403, "Only storekeepers or admins can issue items");
      if (request.status !== "APPROVED") throw new HttpError(409, `Only approved requests can be issued (currently ${request.status})`);
      if (request.item.quantity < request.quantity) {
        throw new HttpError(409, `Insufficient stock on hand: ${request.item.quantity} ${request.item.unit} available`);
      }
      const [u] = await db.$transaction([
        db.itemRequest.update({
          where: { id },
          data: {
            status: "ISSUED",
            reviewerId: session.id,
            issuedAt: new Date(),
            decisionNote: note || request.decisionNote,
          },
          select: requestSelect,
        }),
        db.item.update({
          where: { id: request.itemId },
          data: {
            quantity: { decrement: request.quantity },
            ...(request.item.quantity - request.quantity <= 0 ? { status: "OUT_OF_STOCK" } : {}),
          },
        }),
        db.stockMovement.create({
          data: {
            itemId: request.itemId,
            type: "OUT",
            quantity: request.quantity,
            reference: id,
            note: `Issued to ${request.requester.firstName} ${request.requester.lastName} (${request.requester.empId})`,
            userId: session.id,
          },
        }),
      ]);
      updated = u;
      auditAction = "REQUEST_ISSUE";
      auditDetails = `Issued ${request.quantity} ${request.item.unit} of ${request.item.name} to ${request.requester.firstName} ${request.requester.lastName}`;
      break;
    }
    case "return": {
      if (!isStoreSide) throw new HttpError(403, "Only storekeepers or admins can process returns");
      if (request.status !== "ISSUED") throw new HttpError(409, `Only issued requests can be returned (currently ${request.status})`);
      const [u] = await db.$transaction([
        db.itemRequest.update({
          where: { id },
          data: { status: "RETURNED", returnedAt: new Date(), decisionNote: note || request.decisionNote },
          select: requestSelect,
        }),
        db.item.update({
          where: { id: request.itemId },
          data: {
            quantity: { increment: request.quantity },
            ...(request.item.status === "OUT_OF_STOCK" ? { status: "AVAILABLE" } : {}),
          },
        }),
        db.stockMovement.create({
          data: {
            itemId: request.itemId,
            type: "IN",
            quantity: request.quantity,
            reference: id,
            note: `Returned by ${request.requester.firstName} ${request.requester.lastName}`,
            userId: session.id,
          },
        }),
      ]);
      updated = u;
      auditAction = "REQUEST_RETURN";
      auditDetails = `Processed return of ${request.quantity} ${request.item.unit} of ${request.item.name} from ${request.requester.firstName} ${request.requester.lastName}`;
      break;
    }
    case "cancel": {
      if (!isRequester && !isStoreSide) throw new HttpError(403, "Only the requester can cancel this");
      if (!["PENDING", "APPROVED"].includes(request.status)) {
        throw new HttpError(409, `Cannot cancel a ${request.status} request`);
      }
      updated = await db.itemRequest.update({
        where: { id },
        data: { status: "CANCELLED", decisionNote: note || request.decisionNote },
        select: requestSelect,
      });
      auditAction = "REQUEST_CANCEL";
      auditDetails = `Cancelled request for ${request.quantity} ${request.item.unit} of ${request.item.name}`;
      break;
    }
    default:
      throw new HttpError(400, "Unknown action");
  }

  await audit({
    user: session,
    action: auditAction,
    entity: "REQUEST",
    entityId: id,
    details: auditDetails,
  });

  return NextResponse.json({ request: updated });
});
