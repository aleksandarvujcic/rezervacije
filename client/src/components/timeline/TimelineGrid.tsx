import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import {
  ScrollArea,
  Text,
  Center,
  Loader,
  Stack,
  Group,
  Box,
} from '@mantine/core';
import { IconUsers } from '@tabler/icons-react';
import { useResizeObserver, useMediaQuery } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useTimeline } from '../../hooks/useTimeline';
import { useZones } from '../../hooks/useFloorPlan';
import { workingHoursApi } from '../../api/endpoints';
import type { TimelineEntry } from '../../api/endpoints';
import type { Zone } from '../../api/types';
import { TimelineReservationBlock } from './TimelineReservationBlock';
import { TimelineFilters } from './TimelineFilters';
import {
  generateTimeSlots,
  getReservationSpan,
  getNowSlotIndex,
} from './timelineUtils';

const ZONE_COLORS = [
  { bg: 'var(--mantine-color-teal-0)', text: 'var(--mantine-color-teal-7)', border: 'var(--mantine-color-teal-3)' },
  { bg: 'var(--mantine-color-green-0)', text: 'var(--mantine-color-green-8)', border: 'var(--mantine-color-green-3)' },
  { bg: 'var(--mantine-color-orange-0)', text: 'var(--mantine-color-orange-8)', border: 'var(--mantine-color-orange-3)' },
  { bg: 'var(--mantine-color-violet-0)', text: 'var(--mantine-color-violet-7)', border: 'var(--mantine-color-violet-3)' },
  { bg: 'var(--mantine-color-cyan-0)', text: 'var(--mantine-color-cyan-8)', border: 'var(--mantine-color-cyan-3)' },
  { bg: 'var(--mantine-color-pink-0)', text: 'var(--mantine-color-pink-7)', border: 'var(--mantine-color-pink-3)' },
];

// Desktop
const TABLE_COL_WIDTH = 80;
const MIN_SLOT_WIDTH = 40;
const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 24;
const ZONE_HEADER_HEIGHT = 18;

// Mobile — compact for overview density
const TABLE_COL_WIDTH_MOBILE = 56;
const SLOT_WIDTH_MOBILE = 28;
const ROW_HEIGHT_MOBILE = 20;
const HEADER_HEIGHT_MOBILE = 22;
const ZONE_HEADER_HEIGHT_MOBILE = 16;

interface TimelineGridProps {
  date: string;
  zoneId?: number;
  minCapacity?: number;
  search?: string;
  onCreateReservation: (tableId: number, startTime: string) => void;
  onViewReservation: (reservationId: number) => void;
}

export function TimelineGrid({
  date,
  zoneId,
  minCapacity,
  search: externalSearch,
  onCreateReservation,
  onViewReservation,
}: TimelineGridProps) {
  const { data: timelineData, isLoading } = useTimeline(date, zoneId);
  const { data: zones } = useZones();
  const [nowPosition, setNowPosition] = useState<number | null>(null);
  const isMobile = useMediaQuery('(max-width: 48em)');
  const scrollRef = useRef<HTMLDivElement>(null);
  const didAutoScroll = useRef(false);

  const tableColW = isMobile ? TABLE_COL_WIDTH_MOBILE : TABLE_COL_WIDTH;
  const rowH = isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT;
  const headerH = isMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT;
  const zoneHeaderH = isMobile ? ZONE_HEADER_HEIGHT_MOBILE : ZONE_HEADER_HEIGHT;

  // Filters state
  const [filterZoneId, setFilterZoneId] = useState<number | null>(zoneId ?? null);
  const [filterMinCapacity, setFilterMinCapacity] = useState<number | ''>(minCapacity ?? '');
  const search = externalSearch ?? '';

  const { data: workingHours } = useQuery({
    queryKey: ['working-hours'],
    queryFn: () => workingHoursApi.get(),
  });

  const selectedDayOfWeek = dayjs(date).day();
  const todayHours = useMemo(() => {
    if (!workingHours) return undefined;
    return workingHours.find((wh) => wh.day_of_week === selectedDayOfWeek);
  }, [workingHours, selectedDayOfWeek]);

  const openTime = todayHours?.open_time?.substring(0, 5) ?? '10:00';
  const closeTime = todayHours?.close_time?.substring(0, 5) ?? '23:00';

  const timeSlots = useMemo(
    () => generateTimeSlots(openTime, closeTime),
    [openTime, closeTime]
  );

  const [containerRef, containerRect] = useResizeObserver();
  const containerWidth = containerRect.width;

  const slotWidth = useMemo(() => {
    if (isMobile) return SLOT_WIDTH_MOBILE;
    if (!containerWidth || timeSlots.length === 0) return MIN_SLOT_WIDTH;
    const available = containerWidth - TABLE_COL_WIDTH;
    return Math.max(MIN_SLOT_WIDTH, available / timeSlots.length);
  }, [containerWidth, timeSlots.length, isMobile]);

  // Filter and group entries by zone
  const groupedEntries = useMemo(() => {
    if (!timelineData || !zones) return [];

    let entries = timelineData;

    if (filterZoneId) {
      entries = entries.filter((e) => e.table.zone_id === filterZoneId);
    }

    if (filterMinCapacity && typeof filterMinCapacity === 'number') {
      entries = entries.filter((e) => e.table.capacity >= filterMinCapacity);
    }

    const needle = search.trim().toLowerCase();
    if (needle.length > 0) {
      entries = entries.filter((e) =>
        e.reservations.some(
          (r) =>
            r.guest_name.toLowerCase().includes(needle) ||
            (r.guest_phone && r.guest_phone.includes(needle))
        )
      );
    }

    const zoneMap = new Map<number, { zone: Zone; entries: TimelineEntry[] }>();
    for (const entry of entries) {
      const zone = zones.find((z) => z.id === entry.table.zone_id);
      if (!zone) continue;
      if (!zoneMap.has(zone.id)) {
        zoneMap.set(zone.id, { zone, entries: [] });
      }
      zoneMap.get(zone.id)!.entries.push(entry);
    }

    return Array.from(zoneMap.values()).sort(
      (a, b) => a.zone.sort_order - b.zone.sort_order
    );
  }, [timelineData, zones, filterZoneId, filterMinCapacity, search]);

  // "now" line position
  const updateNow = useCallback(() => {
    const isToday = date === dayjs().format('YYYY-MM-DD');
    if (!isToday) {
      setNowPosition(null);
      return;
    }
    const idx = getNowSlotIndex(openTime);
    if (idx < 0 || idx > timeSlots.length) {
      setNowPosition(null);
      return;
    }
    setNowPosition(idx * slotWidth);
  }, [date, openTime, timeSlots.length, slotWidth]);

  useEffect(() => {
    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, [updateNow]);

  // Auto-scroll to "now" on mobile
  useEffect(() => {
    if (!isMobile || nowPosition === null || didAutoScroll.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const scrollViewport = el.querySelector('[data-radix-scroll-area-viewport], .mantine-ScrollArea-viewport') as HTMLElement | null;
    if (scrollViewport) {
      // Scroll so "now" line is ~1/3 from left
      const offset = Math.max(0, nowPosition - scrollViewport.clientWidth / 3);
      scrollViewport.scrollLeft = offset;
      didAutoScroll.current = true;
    }
  }, [isMobile, nowPosition]);

  // Reset auto-scroll on date change
  useEffect(() => {
    didAutoScroll.current = false;
  }, [date]);

  const handleSlotClick = useCallback(
    (tableId: number, slotTime: string) => {
      onCreateReservation(tableId, slotTime);
    },
    [onCreateReservation]
  );

  const gridContentWidth = timeSlots.length * slotWidth;

  if (isLoading) {
    return (
      <Stack gap={4} h="100%" ref={containerRef}>
        <Center h={300}>
          <Loader size="lg" />
        </Center>
      </Stack>
    );
  }

  if (!timelineData || timelineData.length === 0) {
    return (
      <Stack gap={4} h="100%" ref={containerRef}>
        <Center h={300}>
          <Text c="dimmed">Nema podataka za prikaz</Text>
        </Center>
      </Stack>
    );
  }

  return (
    <Stack gap={isMobile ? 2 : 4} h="100%" ref={containerRef}>
      {/* Desktop filters */}
      {!isMobile && (
        <TimelineFilters
          zones={zones ?? []}
          selectedZoneId={filterZoneId}
          onZoneChange={setFilterZoneId}
          minCapacity={filterMinCapacity}
          onMinCapacityChange={setFilterMinCapacity}
        />
      )}

      {/* Mobile: compact zone filter chips */}
      {isMobile && (
        <ScrollArea type="never" offsetScrollbars={false}>
          <Group gap={4} wrap="nowrap" px={2}>
            <Box
              onClick={() => setFilterZoneId(null)}
              style={{
                padding: '1px 8px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                backgroundColor: filterZoneId === null
                  ? 'var(--mantine-color-teal-6)'
                  : 'var(--mantine-color-gray-1)',
                color: filterZoneId === null ? 'white' : 'var(--mantine-color-gray-7)',
              }}
            >
              Sve
            </Box>
            {(zones ?? [])
              .filter((z) => z.is_active)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((z) => (
                <Box
                  key={z.id}
                  onClick={() => setFilterZoneId(filterZoneId === z.id ? null : z.id)}
                  style={{
                    padding: '1px 8px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    backgroundColor: filterZoneId === z.id
                      ? 'var(--mantine-color-teal-6)'
                      : 'var(--mantine-color-gray-1)',
                    color: filterZoneId === z.id ? 'white' : 'var(--mantine-color-gray-7)',
                  }}
                >
                  {z.name}
                </Box>
              ))}
          </Group>
        </ScrollArea>
      )}

      <div style={{ flex: 1, overflow: 'hidden' }} ref={scrollRef}>
        <ScrollArea h="100%" type="auto" offsetScrollbars>
          <div style={{ display: 'flex', width: tableColW + gridContentWidth }}>
            {/* Sticky table column */}
            <div
              style={{
                width: tableColW,
                flexShrink: 0,
                position: 'sticky',
                left: 0,
                zIndex: 10,
                backgroundColor: 'var(--mantine-color-body)',
                borderRight: '1px solid var(--mantine-color-gray-2)',
              }}
            >
              {/* Header spacer */}
              <div
                style={{
                  height: headerH,
                  borderBottom: '2px solid var(--mantine-color-gray-2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'var(--mantine-color-body)',
                  zIndex: 12,
                }}
              >
                <Text size="xs" fw={700} c="dimmed" style={{ fontSize: isMobile ? 9 : undefined }}>
                  {isMobile ? '#' : 'Sto'}
                </Text>
              </div>

              {/* Table labels per zone */}
              {groupedEntries.map((group, groupIdx) => {
                const zoneColor = ZONE_COLORS[groupIdx % ZONE_COLORS.length];
                return (
                <div key={group.zone.id}>
                  <div
                    style={{
                      height: zoneHeaderH,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: isMobile ? 4 : 8,
                      backgroundColor: zoneColor.bg,
                      borderBottom: `1px solid ${zoneColor.border}`,
                      overflow: 'visible',
                      position: 'relative',
                      zIndex: 11,
                    }}
                  >
                    <Text
                      fw={700}
                      style={{
                        color: zoneColor.text,
                        whiteSpace: 'nowrap',
                        fontSize: isMobile ? 10 : 12,
                        letterSpacing: 0.5,
                      }}
                    >
                      {group.zone.name}
                    </Text>
                  </div>

                  {group.entries.map((entry) => (
                    <div
                      key={entry.table.id}
                      style={{
                        height: rowH,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: '1px solid var(--mantine-color-gray-2)',
                      }}
                    >
                      <Text
                        fw={700}
                        style={{ fontSize: isMobile ? 11 : 13 }}
                      >
                        {entry.table.table_number}
                      </Text>
                      {!isMobile && (
                        <Group gap={2} ml={4}>
                          <IconUsers size={12} color="var(--mantine-color-dimmed)" />
                          <Text size="xs" c="dimmed">
                            {entry.table.capacity}
                          </Text>
                        </Group>
                      )}
                    </div>
                  ))}
                </div>
                );
              })}
            </div>

            {/* Grid area */}
            <div style={{ flex: 1, position: 'relative' }}>
              {/* Time header */}
              <div
                style={{
                  display: 'flex',
                  height: headerH,
                  borderBottom: '2px solid var(--mantine-color-gray-2)',
                  position: 'sticky',
                  top: 0,
                  backgroundColor: 'var(--mantine-color-body)',
                  zIndex: 8,
                }}
              >
                {timeSlots.map((slot) => {
                  const isFullHour = slot.endsWith(':00');
                  return (
                    <div
                      key={slot}
                      style={{
                        width: slotWidth,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderLeft: isFullHour
                          ? '1px solid var(--mantine-color-gray-4)'
                          : '1px solid var(--mantine-color-gray-2)',
                      }}
                    >
                      {/* Mobile: only full hours; Desktop: all slots */}
                      {(isMobile ? isFullHour : true) && (
                        <Text
                          c={isFullHour ? 'dark' : 'dimmed'}
                          fw={isFullHour ? 700 : 500}
                          style={{ fontSize: isMobile ? 10 : 12 }}
                        >
                          {isMobile ? slot.substring(0, 2) : slot}
                        </Text>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Rows */}
              {groupedEntries.map((group, groupIdx) => {
                const zoneColor = ZONE_COLORS[groupIdx % ZONE_COLORS.length];
                return (
                <div key={group.zone.id}>
                  <div
                    style={{
                      height: zoneHeaderH,
                      backgroundColor: zoneColor.bg,
                      borderBottom: `1px solid ${zoneColor.border}`,
                    }}
                  />

                  {group.entries.map((entry) => (
                    <TimelineRow
                      key={entry.table.id}
                      entry={entry}
                      timeSlots={timeSlots}
                      openTime={openTime}
                      slotWidth={slotWidth}
                      rowHeight={rowH}
                      isMobile={isMobile}
                      searchTerm={search}
                      onSlotClick={handleSlotClick}
                      onViewReservation={onViewReservation}
                    />
                  ))}
                </div>
                );
              })}

              {/* "Now" line */}
              {nowPosition !== null && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: nowPosition,
                    width: 1,
                    backgroundColor: 'var(--mantine-color-teal-6)',
                    boxShadow: '0 0 4px var(--mantine-color-teal-4)',
                    zIndex: 5,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'sticky',
                      top: 0,
                      width: isMobile ? 8 : 6,
                      height: isMobile ? 8 : 6,
                      borderRadius: '50%',
                      backgroundColor: 'var(--mantine-color-teal-6)',
                      marginLeft: isMobile ? -3.5 : -2.5,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      <style>{`
        @keyframes pulse-border {
          0%, 100% { border-color: #FF5722; }
          50% { border-color: transparent; }
        }
      `}</style>
    </Stack>
  );
}

// --- TimelineRow ---

interface TimelineRowProps {
  entry: TimelineEntry;
  timeSlots: string[];
  openTime: string;
  slotWidth: number;
  rowHeight: number;
  isMobile?: boolean;
  searchTerm: string;
  onSlotClick: (tableId: number, slotTime: string) => void;
  onViewReservation: (reservationId: number) => void;
}

function TimelineRow({
  entry,
  timeSlots,
  openTime,
  slotWidth,
  rowHeight,
  isMobile,
  searchTerm,
  onSlotClick,
  onViewReservation,
}: TimelineRowProps) {
  const occupiedSlots = useMemo(() => {
    const occupied = new Set<number>();
    for (const res of entry.reservations) {
      const { startCol, spanCols } = getReservationSpan(
        res.start_time,
        res.end_time,
        openTime
      );
      for (let i = Math.floor(startCol); i < Math.ceil(startCol + spanCols); i++) {
        occupied.add(i);
      }
    }
    return occupied;
  }, [entry.reservations, openTime]);

  return (
    <div
      style={{
        height: rowHeight,
        position: 'relative',
        display: 'flex',
        borderBottom: '1px solid var(--mantine-color-gray-2)',
      }}
    >
      {/* Background slot cells */}
      {timeSlots.map((slot, idx) => {
        const isFree = !occupiedSlots.has(idx);
        const isFullHour = slot.endsWith(':00');
        return (
          <div
            key={slot}
            style={{
              width: slotWidth,
              flexShrink: 0,
              borderLeft: isFullHour
                ? '1px solid var(--mantine-color-gray-3)'
                : '1px solid var(--mantine-color-gray-1)',
              // On mobile: stronger green for free slots so availability pops
              backgroundColor: isFree
                ? (isMobile ? 'rgba(76, 175, 80, 0.12)' : 'rgba(76, 175, 80, 0.05)')
                : 'transparent',
              cursor: isFree ? 'pointer' : 'default',
              transition: 'background-color 0.15s',
            }}
            onClick={() => {
              if (isFree) onSlotClick(entry.table.id, slot);
            }}
            onMouseEnter={isMobile ? undefined : (e) => {
              if (isFree)
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  'rgba(76, 175, 80, 0.15)';
            }}
            onMouseLeave={isMobile ? undefined : (e) => {
              if (isFree)
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  'rgba(76, 175, 80, 0.05)';
            }}
          />
        );
      })}

      {/* Reservation blocks */}
      {entry.reservations.map((res) => {
        const { startCol, spanCols } = getReservationSpan(
          res.start_time,
          res.end_time,
          openTime
        );
        if (startCol + spanCols < 0 || startCol > timeSlots.length) return null;

        return (
          <TimelineReservationBlock
            key={res.id}
            reservation={res}
            startCol={startCol}
            spanCols={spanCols}
            slotWidth={slotWidth}
            rowHeight={rowHeight}
            isMobile={isMobile}
            searchTerm={searchTerm}
            onClick={onViewReservation}
          />
        );
      })}
    </div>
  );
}
