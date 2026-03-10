import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client';
import type {
  User,
  Zone,
  Table,
  FloorPlan,
  Reservation,
  WorkingHours,
  ReservationStatus,
  ReservationType,
} from './types';

// --- Auth ---

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    apiPost<LoginResponse>('/auth/login', { username, password }),

  refresh: (refreshToken: string) =>
    apiPost<RefreshResponse>('/auth/refresh', { refreshToken }),

  me: () => apiGet<User>('/auth/me'),
};

// --- Zones ---

export const zonesApi = {
  list: () => apiGet<Zone[]>('/zones'),

  create: (data: Partial<Zone>) => apiPost<Zone>('/zones', data),

  update: (id: number, data: Partial<Zone>) =>
    apiPatch<Zone>(`/zones/${id}`, data),

  delete: (id: number) => apiDelete<void>(`/zones/${id}`),
};

// --- Tables ---

export const tablesApi = {
  listByZone: (zoneId: number) =>
    apiGet<Table[]>(`/zones/${zoneId}/tables`),

  create: (zoneId: number, data: Partial<Table>) =>
    apiPost<Table>(`/zones/${zoneId}/tables`, data),

  update: (id: number, data: Partial<Table & { zone_id: number }>) =>
    apiPatch<Table>(`/tables/${id}`, data),

  delete: (id: number) => apiDelete<void>(`/tables/${id}`),

  updateLayout: (zoneId: number, tables: Partial<Table>[]) =>
    apiPut<Table[]>(`/zones/${zoneId}/tables/layout`, { tables }),
};

// --- Floor Plans ---

export const floorPlansApi = {
  getByZone: (zoneId: number) =>
    apiGet<FloorPlan>(`/zones/${zoneId}/floor-plan`),

  update: (zoneId: number, data: Partial<FloorPlan>) =>
    apiPatch<FloorPlan>(`/zones/${zoneId}/floor-plan`, data),
};

// --- Reservations ---

export interface ReservationFilters {
  date?: string;
  status?: string;
  zone_id?: number;
}

export interface CreateReservationData {
  reservation_type: string;
  guest_name: string;
  guest_phone?: string;
  guest_count: number;
  date: string;
  start_time: string;
  duration_minutes: number;
  notes?: string;
  celebration_details?: string;
  table_ids: number[];
}

export interface WalkinData {
  guest_name: string;
  guest_count: number;
  table_ids: number[];
  date?: string;
  start_time?: string;
  duration_minutes?: number;
  notes?: string;
}

export const reservationsApi = {
  getById: (id: number) => apiGet<Reservation>(`/reservations/${id}`),

  list: (filters?: ReservationFilters) => {
    const params = new URLSearchParams();
    if (filters?.date) params.set('date', filters.date);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.zone_id) params.set('zone_id', String(filters.zone_id));
    const query = params.toString();
    return apiGet<Reservation[]>(`/reservations${query ? `?${query}` : ''}`);
  },

  create: (data: CreateReservationData) =>
    apiPost<Reservation>('/reservations', data),

  update: (id: number, data: Partial<CreateReservationData> & { status?: string }) =>
    apiPatch<Reservation>(`/reservations/${id}`, data),

  delete: (id: number) => apiDelete<void>(`/reservations/${id}`),

  walkin: (data: WalkinData) =>
    apiPost<Reservation>('/reservations/walkin', data),
};

// --- Availability ---

export interface AvailabilityParams {
  date: string;
  time: string;
  duration: number;
  guests: number;
}

export interface AvailabilityResult {
  available_tables: Table[];
}

export interface TimelineReservation {
  id: number;
  guest_name: string;
  guest_phone: string | null;
  guest_count: number;
  start_time: string;
  end_time: string;
  status: ReservationStatus;
  reservation_type: ReservationType;
  table_id: number;
}

export interface TimelineEntry {
  table: Table;
  reservations: TimelineReservation[];
}

export const availabilityApi = {
  check: (params: AvailabilityParams) => {
    const query = new URLSearchParams({
      date: params.date,
      time: params.time,
      duration: String(params.duration),
      guests: String(params.guests),
    }).toString();
    return apiGet<AvailabilityResult>(`/availability?${query}`);
  },

  timeline: (date: string, zoneId?: number) => {
    const params = new URLSearchParams({ date });
    if (zoneId) params.set('zoneId', String(zoneId));
    return apiGet<TimelineEntry[]>(`/availability/timeline?${params.toString()}`);
  },
};

// --- Working Hours ---

export const workingHoursApi = {
  get: () => apiGet<WorkingHours[]>('/working-hours'),

  update: (data: Partial<WorkingHours>[]) =>
    apiPut<WorkingHours[]>('/working-hours', data),
};

// --- Users ---

export interface CreateUserData {
  username: string;
  password: string;
  display_name: string;
  role: string;
}

export const usersApi = {
  list: () => apiGet<User[]>('/users'),

  create: (data: CreateUserData) => apiPost<User>('/users', data),

  update: (id: number, data: Partial<CreateUserData & { is_active: boolean }>) =>
    apiPatch<User>(`/users/${id}`, data),

  delete: (id: number) => apiDelete<void>(`/users/${id}`),
};
