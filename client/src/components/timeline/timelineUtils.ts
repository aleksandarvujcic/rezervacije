import dayjs from 'dayjs';

/** Generate array of "HH:mm" time slot labels at 30-min intervals */
export function generateTimeSlots(openTime: string, closeTime: string): string[] {
  const base = '2000-01-01';
  let start = dayjs(`${base} ${openTime}`);
  let end = dayjs(`${base} ${closeTime}`);

  // If close time is before open time, it's past midnight
  if (end.isBefore(start) || end.isSame(start)) {
    end = end.add(1, 'day');
  }

  const slots: string[] = [];
  let current = start;
  while (current.isBefore(end)) {
    slots.push(current.format('HH:mm'));
    current = current.add(30, 'minute');
  }
  return slots;
}

/** Convert "HH:mm" time to a slot index relative to openTime (30-min slots) */
export function timeToSlotIndex(time: string, openTime: string): number {
  const base = '2000-01-01';
  const t = dayjs(`${base} ${time}`);
  const open = dayjs(`${base} ${openTime}`);
  const diffMinutes = t.diff(open, 'minute');
  return diffMinutes / 30;
}

/** Get start column index and span (in 30-min slots) for a reservation */
export function getReservationSpan(
  startTime: string,
  endTime: string,
  openTime: string
): { startCol: number; spanCols: number } {
  const startCol = timeToSlotIndex(startTime.substring(0, 5), openTime);
  const endCol = timeToSlotIndex(endTime.substring(0, 5), openTime);
  const spanCols = Math.max(endCol - startCol, 0.5); // minimum half slot
  return { startCol, spanCols };
}

/** Check if a reservation's end time is within thresholdMinutes of now */
export function isEndingSoon(endTime: string, thresholdMinutes: number = 30): boolean {
  const now = dayjs();
  const end = dayjs(`${now.format('YYYY-MM-DD')} ${endTime.substring(0, 5)}`);
  const diffMin = end.diff(now, 'minute');
  return diffMin > 0 && diffMin <= thresholdMinutes;
}

/** Minutes until a given time from now */
export function minutesUntil(time: string): number {
  const now = dayjs();
  const target = dayjs(`${now.format('YYYY-MM-DD')} ${time.substring(0, 5)}`);
  return target.diff(now, 'minute');
}

/** Get the "now" position as fractional slot index */
export function getNowSlotIndex(openTime: string): number {
  const now = dayjs().format('HH:mm');
  return timeToSlotIndex(now, openTime);
}
