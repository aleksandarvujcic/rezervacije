import type { Reservation, ReservationStatus } from '../../api/types';
import { STATUS_COLORS } from '../../config/statusConfig';
import dayjs from 'dayjs';

/**
 * Returns the hex color for a given table/reservation status.
 * null/undefined means the table is free (green).
 */
export function getTableColor(status: ReservationStatus | null | undefined): string {
  if (status === null || status === undefined) {
    return STATUS_COLORS.free;
  }
  return STATUS_COLORS[status] ?? STATUS_COLORS.free;
}

/**
 * Returns default dimensions { width, height } based on table capacity.
 */
export function getTableDimensions(capacity: number): { width: number; height: number } {
  if (capacity <= 2) return { width: 60, height: 60 };
  if (capacity <= 4) return { width: 80, height: 60 };
  if (capacity <= 6) return { width: 100, height: 70 };
  return { width: 120, height: 80 };
}

/**
 * Determines what reservation status a table currently has at the given time.
 *
 * A table takes the status of its active reservation (not otkazana/no_show/zavrsena)
 * that overlaps the current time. If no active reservation overlaps, it's free (null).
 */
export function getTableStatusForTime(
  tableId: number,
  reservations: Reservation[],
  selectedDate: string,
  currentTime?: string
): { status: ReservationStatus | null; reservation: Reservation | null } {
  const now = currentTime || dayjs().format('HH:mm');

  // Filter reservations that include this table on the selected date
  const tableReservations = reservations.filter(
    (r) =>
      dayjs(r.date).format('YYYY-MM-DD') === selectedDate &&
      r.tables.some((t) => (t.table_id ?? t.id) === tableId)
  );

  // Find an active reservation that overlaps the current time
  const inactiveStatuses: ReservationStatus[] = ['otkazana', 'no_show', 'zavrsena'];

  for (const reservation of tableReservations) {
    // Skip inactive reservations
    if (inactiveStatuses.includes(reservation.status)) {
      continue;
    }

    const startTime = reservation.start_time.substring(0, 5); // "HH:mm"
    const endTime = reservation.end_time
      ? reservation.end_time.substring(0, 5)
      : dayjs(`${selectedDate} ${reservation.start_time}`)
          .add(reservation.duration_minutes, 'minute')
          .format('HH:mm');

    // Check if current time falls within [startTime, endTime)
    if (now >= startTime && now < endTime) {
      return { status: reservation.status, reservation };
    }
  }

  return { status: null, reservation: null };
}
