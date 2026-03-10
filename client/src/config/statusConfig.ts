import type { ReservationStatus } from '../api/types';

/** Hex colors for each reservation status + 'free' pseudo-status */
export const STATUS_COLORS: Record<ReservationStatus | 'free', string> = {
  free: '#099268',       // teal-8 — slobodan sto (WCAG AA fix)
  nova: '#1971C2',       // blue-8 — nova rezervacija
  potvrdjena: '#1864AB', // blue-9 — potvrđena
  seated: '#C2255C',     // pink-8 — gost za stolom (WCAG AA fix, was orange)
  zavrsena: '#868E96',   // gray-6 — završena (neutralna, gotovo)
  otkazana: '#C92A2A',   // red-8 — otkazana (WCAG AA fix)
  no_show: '#C92A2A',    // red-8 — no-show (najnegativnija)
  waitlist: '#862E9C',   // grape-8 — lista čekanja (WCAG AA fix)
  odlozena: '#E67700',   // yellow-9 — odložena (WCAG AA fix, was #F08C00)
};

/** Display labels for each status */
export const STATUS_LABELS: Record<ReservationStatus, string> = {
  nova: 'Nova',
  potvrdjena: 'Nova',
  seated: 'Za stolom',
  zavrsena: 'Završena',
  otkazana: 'Otkazana',
  no_show: 'No-show',
  waitlist: 'Lista čekanja',
  odlozena: 'Odložena',
};

/** Options array for Select/MultiSelect components */
export const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: 'nova', label: 'Nova' },
  { value: 'potvrdjena', label: 'Potvrđena' },
  { value: 'seated', label: 'Za stolom' },
  { value: 'zavrsena', label: 'Završena' },
  { value: 'otkazana', label: 'Otkazana' },
  { value: 'no_show', label: 'No-show' },
  { value: 'waitlist', label: 'Lista čekanja' },
  { value: 'odlozena', label: 'Odložena' },
];

/** Valid status transitions — bidirectional, always allow revert */
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

/** Legend items for floor plan / timeline */
export const LEGEND_ITEMS: { color: string; label: string }[] = [
  { color: STATUS_COLORS.free, label: 'Slobodan' },
  { color: STATUS_COLORS.nova, label: 'Nova' },
  { color: STATUS_COLORS.seated, label: 'Za stolom' },
  { color: STATUS_COLORS.zavrsena, label: 'Završena' },
  { color: STATUS_COLORS.waitlist, label: 'Lista čekanja' },
  { color: STATUS_COLORS.odlozena, label: 'Odložena' },
];

/** Action labels (imperative form, for transition buttons) */
export const STATUS_ACTION_LABELS: Record<ReservationStatus, string> = {
  nova: 'Nova',
  potvrdjena: 'Nova',
  seated: 'Za stolom',
  zavrsena: 'Završi',
  otkazana: 'Otkaži',
  no_show: 'No-show',
  waitlist: 'Lista čekanja',
  odlozena: 'Odloži',
};
