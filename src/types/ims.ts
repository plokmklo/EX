/**
 * EX-IMS shared DTO types — mirrors docs/API-CONTRACT.md exactly.
 */

export type Role = 'ADMIN' | 'MANAGER' | 'STOREKEEPER' | 'STAFF';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export type ItemStatus = 'AVAILABLE' | 'OUT_OF_STOCK' | 'MAINTENANCE' | 'DISCONTINUED';

export type RequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ISSUED'
  | 'RETURNED'
  | 'CANCELLED';

export type MovementType = 'IN' | 'OUT' | 'ADJUST';

export interface SafeUser {
  id: string;
  empId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string | null;
  office: string | null;
  role: Role;
  status: UserStatus;
  createdAt: string; // ISO
}

export interface CategoryRef {
  id: string;
  name: string;
}

export interface ItemDto {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  category: CategoryRef;
  brand: string | null;
  model: string | null;
  serial: string | null;
  unit: string;
  quantity: number;
  minStockLevel: number;
  unitPrice: number;
  location: string | null;
  description: string | null;
  status: ItemStatus;
  reservedQty: number;
  availableQty: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RequestItemRef {
  id: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  availableQty: number;
}

export interface RequestUserRef {
  id: string;
  firstName: string;
  lastName: string;
  empId?: string;
  email?: string;
}

export interface RequestDto {
  id: string;
  itemId: string;
  quantity: number;
  reason: string | null;
  status: RequestStatus;
  item: RequestItemRef;
  requester: RequestUserRef;
  reviewer: Pick<RequestUserRef, 'id' | 'firstName' | 'lastName'> | null;
  reviewedAt: string | null;
  decisionNote: string | null;
  issuedAt: string | null;
  returnedAt: string | null;
  createdAt: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  itemCount?: number;
  createdAt: string;
}

export interface AuditDto {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  actorName: string | null;
  userId: string | null;
  createdAt: string;
}

export interface MovementDto {
  id: string;
  type: MovementType;
  quantity: number;
  note: string | null;
  item: { id: string; code: string; name: string };
  user: { firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface CommentDto {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; role: Role };
}

/** List envelope */
export interface ListEnvelope<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardKpis {
  totalItems: number;
  totalUnits: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingRequests: number;
  activeLoans: number;
  usersCount: number;
  requestsThisMonth: number;
}

export interface DashboardResponse {
  kpis: DashboardKpis;
  categoryBreakdown: { name: string; itemCount: number; totalValue: number }[];
  statusBreakdown: { name: string; itemCount: number }[];
  movements7d: { date: string; in: number; out: number }[];
  topRequested: { name: string; requestCount: number }[];
  recentActivity: AuditDto[];
}

export interface ItemDetailResponse {
  item: ItemDto;
  comments: CommentDto[];
  movements: MovementDto[];
  requests: RequestDto[];
}

export interface ValuationRow {
  categoryId: string;
  categoryName: string;
  itemCount: number;
  totalUnits: number;
  totalValue: number;
}

export interface ValuationReport {
  data: ValuationRow[];
  totals: { totalValue: number; totalUnits: number; totalItems: number; categories: number };
}

export interface MovementsReport {
  data: MovementDto[];
  total: number;
}

export interface RequestsReport {
  byStatus: { name: string; count: number }[];
  byDay: { date: string; count: number }[];
  avgDecisionHours: number;
  topRequesters: { name: string; count: number }[];
}

/** View identifiers for the SPA shell */
export type ImsView =
  | 'dashboard'
  | 'inventory'
  | 'requests'
  | 'users'
  | 'reports'
  | 'audit'
  | 'settings';
