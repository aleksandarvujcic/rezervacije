export interface User {
  id: number;
  username: string;
  display_name: string;
  role: 'owner' | 'manager' | 'hostess' | 'waiter';
  is_active: boolean;
}

export interface Zone {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  is_seasonal: boolean;
  season_start: string | null;
  season_end: string | null;
  sort_order: number;
}

export interface FloorPlan {
  id: number;
  zone_id: number;
  canvas_width: number;
  canvas_height: number;
  background_image_url: string | null;
}

export interface Table {
  id: number;
  zone_id: number;
  table_number: string;
  capacity: number;
  shape: 'rectangle' | 'circle' | 'square';
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  rotation: number;
  is_active: boolean;
}

export interface ReservationTable {
  id: number;
  table_id: number;
  table_number: string;
  zone_id: number;
}

export type ReservationStatus =
  | 'nova'
  | 'potvrdjena'
  | 'seated'
  | 'zavrsena'
  | 'otkazana'
  | 'no_show'
  | 'waitlist'
  | 'odlozena';

export type ReservationType = 'standard' | 'celebration' | 'walkin';

export interface Reservation {
  id: number;
  reservation_type: ReservationType;
  status: ReservationStatus;
  guest_name: string;
  guest_phone: string | null;
  guest_count: number;
  date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  notes: string | null;
  celebration_details: string | null;
  created_by: number;
  created_by_name: string | null;
  updated_by: number | null;
  created_at: string;
  tables: ReservationTable[];
}

export interface WorkingHours {
  id: number;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export type Permission =
  | 'create_reservation'
  | 'create_walkin'
  | 'delete_reservation'
  | 'transfer_table'
  | 'status_no_show'
  | 'status_otkazana'
  | 'status_odlozena';

export interface RolePermission {
  role: string;
  permission: Permission;
  allowed: boolean;
}
