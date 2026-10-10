import { z } from "zod";

export const ROLES = ["ADMIN", "MANAGER", "STOREKEEPER", "STAFF"] as const;
export const ITEM_STATUSES = [
  "AVAILABLE",
  "OUT_OF_STOCK",
  "MAINTENANCE",
  "DISCONTINUED",
] as const;
export const REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "ISSUED",
  "RETURNED",
  "CANCELLED",
] as const;
export const USER_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Email or employee ID is required"),
  password: z.string().min(1, "Password is required"),
});

export const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  department: z.string().trim().max(80).optional().nullable(),
  office: z.string().trim().max(80).optional().nullable(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(128),
});

export const userCreateSchema = z.object({
  empId: z.string().trim().min(2).max(30),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: z.enum(ROLES),
  phone: z.string().trim().max(30).optional().nullable(),
  department: z.string().trim().max(80).optional().nullable(),
  office: z.string().trim().max(80).optional().nullable(),
  status: z.enum(USER_STATUSES).optional(),
});

export const userUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  department: z.string().trim().max(80).optional().nullable(),
  office: z.string().trim().max(80).optional().nullable(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  description: z.string().trim().max(300).optional().nullable(),
});

export const itemCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(40),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  categoryId: z.string().min(1, "Category is required"),
  quantity: z.coerce.number().int("Quantity must be a whole number").min(0),
  unit: z.string().trim().max(20).optional(),
  minStockLevel: z.coerce.number().int().min(0).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  brand: z.string().trim().max(80).optional().nullable(),
  model: z.string().trim().max(80).optional().nullable(),
  serial: z.string().trim().max(80).optional().nullable(),
  location: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(ITEM_STATUSES).optional(),
});

export const itemUpdateSchema = itemCreateSchema.partial();

export const requestCreateSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const requestActionSchema = z.object({
  action: z.enum(["approve", "reject", "issue", "return", "cancel"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(1000),
});
