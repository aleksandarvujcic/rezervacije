/**
 * Server-side status transition validation.
 * Must mirror client/src/config/statusConfig.ts VALID_TRANSITIONS.
 */

export type ReservationStatus =
  | 'nova'
  | 'potvrdjena'
  | 'seated'
  | 'zavrsena'
  | 'otkazana'
  | 'no_show'
  | 'waitlist'
  | 'odlozena';

const ALL_STATUSES = new Set<string>([
  'nova', 'potvrdjena', 'seated', 'zavrsena', 'otkazana', 'no_show', 'waitlist', 'odlozena',
]);

export const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  nova: ['seated', 'no_show', 'otkazana', 'odlozena'],
  potvrdjena: ['seated', 'no_show', 'otkazana', 'odlozena'],
  seated: ['zavrsena', 'nova'],
  waitlist: ['nova', 'otkazana'],
  odlozena: ['nova', 'otkazana'],
  zavrsena: ['seated'],
  otkazana: ['nova'],
  no_show: ['nova'],
};

export function isValidStatus(status: string): status is ReservationStatus {
  return ALL_STATUSES.has(status);
}

export function isValidTransition(from: string, to: string): boolean {
  if (!isValidStatus(from) || !isValidStatus(to)) return false;
  return VALID_TRANSITIONS[from].includes(to);
}
