/**
 * EX-IMS typed API client — relative URLs only, cookie-based auth.
 * Mirrors docs/API-CONTRACT.md.
 */
import type {
  AuditDto,
  CategoryDto,
  CommentDto,
  DashboardResponse,
  ItemDetailResponse,
  ItemDto,
  ListEnvelope,
  MovementsReport,
  MovementDto,
  MovementType,
  ItemStatus,
  RequestDto,
  RequestStatus,
  RequestsReport,
  Role,
  SafeUser,
  UserStatus,
  ValuationReport,
} from '@/types/ims';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export function buildQuery(q?: Query): string {
  if (!q) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      headers:
        init?.body !== undefined
          ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
          : init?.headers,
      ...init,
    });
  } catch {
    throw new ApiError(0, 'Network error — check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

export const get = <T>(path: string) => apiFetch<T>(path);
export const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
export const put = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) });
export const del = <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' });

/* ----------------------------- Auth ----------------------------- */

export const authApi = {
  me: () => get<{ user: SafeUser }>('/api/auth/me'),
  login: (identifier: string, password: string) =>
    post<{ user: SafeUser }>('/api/auth/login', { identifier, password }),
  logout: () => post<{ ok: boolean }>('/api/auth/logout'),
  updateProfile: (body: Partial<Pick<SafeUser, 'firstName' | 'lastName' | 'phone' | 'department' | 'office'>>) =>
    put<{ user: SafeUser }>('/api/auth/profile', body),
  changePassword: (currentPassword: string, newPassword: string) =>
    put<{ ok: boolean }>('/api/auth/password', { currentPassword, newPassword }),
};

/* ----------------------------- Categories ----------------------------- */

export const categoriesApi = {
  list: () => get<{ data: CategoryDto[] }>('/api/categories'),
  create: (body: { name: string; description?: string }) =>
    post<{ category: CategoryDto }>('/api/categories', body),
};

/* ----------------------------- Items ----------------------------- */

export interface ItemFilters {
  search?: string;
  categoryId?: string;
  status?: ItemStatus | '';
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'quantity' | 'unitPrice' | 'createdAt';
  order?: 'asc' | 'desc';
}

export const itemsApi = {
  list: (f: ItemFilters = {}) =>
    get<ListEnvelope<ItemDto>>(
      `/api/items${buildQuery({
        search: f.search,
        categoryId: f.categoryId,
        status: f.status,
        lowStock: f.lowStock ? 1 : undefined,
        page: f.page ?? 1,
        pageSize: f.pageSize ?? 10,
        sort: f.sort,
        order: f.sort ? f.order ?? 'asc' : undefined,
      })}`,
    ),
  detail: (id: string) => get<ItemDetailResponse>(`/api/items/${id}`),
  qr: (id: string) => get<{ svg: string; item: { id: string; code: string; name: string } }>(`/api/items/${id}/qr`),
  create: (body: Record<string, unknown>) => post<{ item: ItemDto }>('/api/items', body),
  update: (id: string, body: Record<string, unknown>) => put<{ item: ItemDto }>(`/api/items/${id}`, body),
  remove: (id: string) => del<{ ok: boolean }>(`/api/items/${id}`),
  addComment: (id: string, body: string) => post<{ comment: CommentDto }>(`/api/items/${id}/comments`, { body }),
};

/* ----------------------------- Requests ----------------------------- */

export interface RequestFilters {
  status?: RequestStatus | '';
  page?: number;
  pageSize?: number;
  mine?: boolean;
}

export const requestsApi = {
  list: (f: RequestFilters = {}) =>
    get<ListEnvelope<RequestDto>>(
      `/api/requests${buildQuery({
        status: f.status,
        page: f.page ?? 1,
        pageSize: f.pageSize ?? 10,
        mine: f.mine ? 1 : undefined,
      })}`,
    ),
  create: (body: { itemId: string; quantity: number; reason?: string }) =>
    post<{ request: RequestDto }>('/api/requests', body),
  act: (id: string, action: 'approve' | 'reject' | 'issue' | 'return' | 'cancel', note?: string) =>
    put<{ request: RequestDto }>(`/api/requests/${id}`, { action, note }),
};

/* ----------------------------- Users ----------------------------- */

export interface UserFilters {
  search?: string;
  role?: Role | '';
  status?: UserStatus | '';
  page?: number;
  pageSize?: number;
}

export const usersApi = {
  list: (f: UserFilters = {}) =>
    get<ListEnvelope<SafeUser>>(
      `/api/users${buildQuery({
        search: f.search,
        role: f.role,
        status: f.status,
        page: f.page ?? 1,
        pageSize: f.pageSize ?? 10,
      })}`,
    ),
  create: (body: Record<string, unknown>) => post<{ user: SafeUser }>('/api/users', body),
  update: (id: string, body: Record<string, unknown>) => put<{ user: SafeUser }>(`/api/users/${id}`, body),
};

/* ----------------------------- Dashboard / Reports / Audit ----------------------------- */

export const dashboardApi = {
  get: () => get<DashboardResponse>('/api/dashboard'),
};

export const reportsApi = {
  valuation: () => get<ValuationReport>('/api/reports?type=valuation'),
  movements: (days: number) => get<MovementsReport>(`/api/reports?type=movements&days=${days}`),
  requests: (days: number) => get<RequestsReport>(`/api/reports?type=requests&days=${days}`),
};

export const auditApi = {
  list: (f: { entity?: string; search?: string; page?: number; pageSize?: number } = {}) =>
    get<ListEnvelope<AuditDto>>(
      `/api/audit${buildQuery({
        entity: f.entity,
        search: f.search,
        page: f.page ?? 1,
        pageSize: f.pageSize ?? 15,
      })}`,
    ),
};

/* ----------------------------- Notifications ----------------------------- */

export interface NotificationDto {
  id: string;
  type: 'REQUEST_UPDATE' | 'REQUEST_PENDING' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  title: string;
  body: string;
  createdAt: string;
  targetView: 'requests' | 'inventory';
}

export const notificationsApi = {
  list: () => get<{ data: NotificationDto[]; total: number }>('/api/notifications'),
};

export type { MovementType, ItemStatus };
