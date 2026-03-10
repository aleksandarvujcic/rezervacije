import type { ReservationStatus } from '../api/types';

/** Hex colors for each reservation status + 'free' pseudo-status */
export const STATUS_COLORS: Record<ReservationStatus | 'free', string> = {
  free: '#12B886',
  nova: '#339AF0',
  potvrdjena: '#1C7ED6',
  seated: '#F59F00',
  zavrsena: '#ADB5BD',
  otkazana: '#CED4DA',
  no_show: '#FA5252',
  waitlist: '#AE3EC9',
  odlozena: '#5C7CFA',
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
  { value: 'seated', label: 'Za stolom' },
  { value: 'zavrsena', label: 'Završena' },
  { value: 'otkazana', label: 'Otkazana' },
  { value: 'no_show', label: 'No-show' },
  { value: 'waitlist', label: 'Lista čekanja' },
  { value: 'odlozena', label: 'Odložena' },
];

/** Valid status transitions — bidirectional, always allow revert */
export const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  nova: ['seated', 'otkazana', 'odlozena'],
  potvrdjena: ['seated', 'otkazana', 'odlozena'],
  seated: ['zavrsena', 'no_show', 'nova'],
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
