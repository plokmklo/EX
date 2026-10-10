import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withErrorHandling, parseIntParam } from "@/lib/api-utils";
import { requirePermission, requireAuth, hashPassword, HttpError } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { userCreateSchema } from "@/lib/validators";

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

export const GET = withErrorHandling(async (req: NextRequest) => {
  const auth = await requireAuth();
  if (auth.role !== "ADMIN" && auth.role !== "MANAGER") {
    throw new HttpError(403, "Forbidden");
  }
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const role = url.searchParams.get("role");
  const status = url.searchParams.get("status");
  const page = parseIntParam(url.searchParams.get("page"), 1);
  const pageSize = parseIntParam(url.searchParams.get("pageSize"), 10, { max: 100 });

  const where = {
    AND: [
      search
        ? {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
              { email: { contains: search } },
              { empId: { contains: search } },
              { department: { contains: search } },
            ],
          }
        : {},
      role && ["ADMIN", "MANAGER", "STOREKEEPER", "STAFF"].includes(role)
        ? { role }
        : {},
      status && ["ACTIVE", "INACTIVE"].includes(status) ? { status } : {},
    ],
  };

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      select: safeSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ data: users, total, page, pageSize });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requirePermission("MANAGE_USERS");
  const body = await req.json().catch(() => ({}));
  const data = userCreateSchema.parse(body);

  const dup = await db.user.findFirst({
    where: { OR: [{ email: data.email }, { empId: data.empId }] },
    select: { email: true, empId: true },
  });
  if (dup) {
    const field = dup.email === data.email ? "email" : "employee ID";
    throw new HttpError(409, `A user with this ${field} already exists`);
  }

  const created = await db.user.create({
    data: {
      empId: data.empId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone || null,
      department: data.department || null,
      office: data.office || null,
      role: data.role,
      status: data.status ?? "ACTIVE",
      passwordHash: await hashPassword(data.password),
    },
    select: safeSelect,
  });

  await audit({
    user: session,
    action: "USER_CREATE",
    entity: "USER",
    entityId: created.id,
    details: `Created ${created.role} account for ${created.firstName} ${created.lastName} (${created.empId})`,
  });

  return NextResponse.json({ user: created }, { status: 201 });
});
