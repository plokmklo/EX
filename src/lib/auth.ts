import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE = "ims_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SECRET =
  process.env.AUTH_SECRET || "ex-ims-dev-secret-change-in-production-0f3a9c";

export type Role = "ADMIN" | "MANAGER" | "STOREKEEPER" | "STAFF";

export interface SessionPayload {
  sub: string; // user id
  role: Role;
  exp: number; // epoch seconds
  jti: string;
}

/* ---------------- password ---------------- */

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/* ---------------- token (HMAC-SHA256 signed) ---------------- */

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const b = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b, "base64");
}

function sign(data: string): string {
  return b64url(createHmac("sha256", SECRET).update(data).digest());
}

export function signSession(
  payload: Omit<SessionPayload, "exp" | "jti">
): { token: string; maxAge: number } {
  const full: SessionPayload = {
    ...payload,
    jti: randomBytes(12).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(full));
  const mac = sign(body);
  return { token: `${body}.${mac}`, maxAge: SESSION_TTL_SECONDS };
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = sign(body);
  try {
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(b64urlDecode(body).toString()) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------------- session helpers for route handlers ---------------- */

export interface SessionUser {
  id: string;
  empId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  department: string | null;
  office: string | null;
  role: Role;
  status: string;
  createdAt: Date;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const payload = verifySession(token);
  if (!payload) return null;
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      empId: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      department: true,
      office: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return { ...user, role: user.role as Role };
}

export function toSafeUser(u: SessionUser) {
  return {
    id: u.id,
    empId: u.empId,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    department: u.department,
    office: u.office,
    role: u.role,
    status: u.status as "ACTIVE" | "INACTIVE",
    createdAt: u.createdAt,
  };
}

/* ---------------- RBAC ---------------- */

export const PERMISSIONS = {
  MANAGE_USERS: ["ADMIN"],
  VIEW_USERS: ["ADMIN", "MANAGER"],
  MANAGE_ITEMS: ["ADMIN", "STOREKEEPER"],
  DELETE_ITEMS: ["ADMIN"],
  REVIEW_REQUESTS: ["ADMIN", "MANAGER", "STOREKEEPER"],
  ISSUE_RETURN: ["ADMIN", "STOREKEEPER"],
  VIEW_REPORTS: ["ADMIN", "MANAGER"],
  VIEW_AUDIT: ["ADMIN", "MANAGER"],
  MANAGE_CATEGORIES: ["ADMIN", "STOREKEEPER"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Authentication required");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireAuth();
  if (!hasPermission(user.role, permission)) {
    throw new HttpError(403, `Forbidden — requires ${permission}`);
  }
  return user;
}

/* ---------------- login rate limiting (in-memory) ---------------- */

interface Attempt {
  count: number;
  resetAt: number;
}
const attempts = new Map<string, Attempt>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { allowed: true };
}

export function clearRateLimit(key: string): void {
  attempts.delete(key);
}
