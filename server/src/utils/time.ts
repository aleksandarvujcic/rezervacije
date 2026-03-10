/**
 * Shared time utility helpers.
 */

export function normalizeTime(time: string): string {
  return time.slice(0, 5);
}

export function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function validateDateFormat(date: string): boolean {
  return DATE_RE.test(date);
}

export function validateTimeFormat(time: string): boolean {
  return TIME_RE.test(time);
}
