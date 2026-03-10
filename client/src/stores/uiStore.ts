import { create } from 'zustand';
import dayjs from 'dayjs';

interface UIState {
  selectedDate: string;
  selectedZoneId: number | null;
  selectedTableId: number | null;

  setSelectedDate: (date: string) => void;
  setSelectedZoneId: (zoneId: number | null) => void;
  setSelectedTableId: (tableId: number | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedDate: dayjs().format('YYYY-MM-DD'),
  selectedZoneId: null,
  selectedTableId: null,

  setSelectedDate: (date: string) => set({ selectedDate: date }),
  setSelectedZoneId: (zoneId: number | null) => set({ selectedZoneId: zoneId }),
  setSelectedTableId: (tableId: number | null) =>
    set({ selectedTableId: tableId }),
}));
