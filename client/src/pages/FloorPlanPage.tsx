import { useState, useCallback } from 'react';
import {
  Group,
  Button,
  ActionIcon,
  Loader,
  Center,
  Text,
  Stack,
  SegmentedControl,
  TextInput,
  Box,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconPlus,
  IconWalk,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { AppLayout } from '../components/layout/AppLayout';
import { ReservationForm } from '../components/reservations/ReservationForm';
import { ReservationDrawer } from '../components/reservations/ReservationDrawer';
import { WalkinForm } from '../components/reservations/WalkinForm';
import { TimelineGrid } from '../components/timeline/TimelineGrid';
import { MobileAgendaView } from '../components/timeline/MobileAgendaView';
import { MobileFAB } from '../components/layout/MobileFAB';
import { useZones } from '../hooks/useFloorPlan';
import { useUIStore } from '../stores/uiStore';
import { reservationsApi } from '../api/endpoints';
import type { Reservation } from '../api/types';

const DAYS_SR = [
  'Nedelja',
  'Ponedeljak',
  'Utorak',
  'Sreda',
  'Cetvrtak',
  'Petak',
  'Subota',
];

const DAYS_SR_SHORT = ['Ned', 'Pon', 'Uto', 'Sre', 'Cet', 'Pet', 'Sub'];

const MONTHS_SR = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'jun',
  'jul',
  'avgust',
  'septembar',
  'oktobar',
  'novembar',
  'decembar',
];

const MONTHS_SR_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'avg', 'sep', 'okt', 'nov', 'dec',
];

function formatDateSr(dateStr: string): string {
  const d = dayjs(dateStr);
  const dayName = DAYS_SR[d.day()];
  const day = d.date();
  const month = MONTHS_SR[d.month()];
  const year = d.year();
  return `${dayName}, ${day}. ${month} ${year}`;
}

function formatDateSrShort(dateStr: string): string {
  const d = dayjs(dateStr);
  const dayName = DAYS_SR_SHORT[d.day()];
  const day = d.date();
  const month = MONTHS_SR_SHORT[d.month()];
  return `${dayName}, ${day}. ${month}`;
}

export function FloorPlanPage() {
  const selectedDate = useUIStore((s) => s.selectedDate);
  const setSelectedDate = useUIStore((s) => s.setSelectedDate);
  const selectedTableId = useUIStore((s) => s.selectedTableId);
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [mobileView, setMobileView] = useState<'agenda' | 'timeline'>('agenda');
  const [search, setSearch] = useState('');

  const [reservationFormOpened, reservationFormHandlers] = useDisclosure(false);
  const [walkinFormOpened, walkinFormHandlers] = useDisclosure(false);
  const [drawerOpened, drawerHandlers] = useDisclosure(false);
  const [formTableIds, setFormTableIds] = useState<number[]>([]);
  const [formStartTime, setFormStartTime] = useState<string | undefined>(undefined);
  const [editingReservation, setEditingReservation] = useState<Reservation | undefined>(undefined);
  const [viewingReservation, setViewingReservation] = useState<Reservation | null>(null);

  const { data: zones, isLoading: zonesLoading } = useZones();

  const activeZones = zones?.filter((z) => z.is_active) ?? [];

  const goToPrevDay = useCallback(() => {
    setSelectedDate(dayjs(selectedDate).subtract(1, 'day').format('YYYY-MM-DD'));
  }, [selectedDate, setSelectedDate]);

  const goToNextDay = useCallback(() => {
    setSelectedDate(dayjs(selectedDate).add(1, 'day').format('YYYY-MM-DD'));
  }, [selectedDate, setSelectedDate]);

  const goToToday = useCallback(() => {
    setSelectedDate(dayjs().format('YYYY-MM-DD'));
  }, [setSelectedDate]);

  const handleTimelineCreate = useCallback(
    (tableId: number, startTime: string) => {
      setEditingReservation(undefined);
      setFormTableIds([tableId]);
      setFormStartTime(startTime);
      reservationFormHandlers.open();
    },
    [reservationFormHandlers]
  );

  const handleTimelineView = useCallback(
    async (reservationId: number) => {
      try {
        const reservation = await reservationsApi.getById(reservationId);
        setViewingReservation(reservation);
        drawerHandlers.open();
      } catch {
        // silently fail
      }
    },
    [drawerHandlers]
  );

  const handleEditFromDrawer = useCallback(
    (reservation: Reservation) => {
      setEditingReservation(reservation);
      setFormTableIds([]);
      setFormStartTime(undefined);
      drawerHandlers.close();
      reservationFormHandlers.open();
    },
    [drawerHandlers, reservationFormHandlers]
  );

  const handleNewReservation = useCallback(() => {
    setEditingReservation(undefined);
    setFormTableIds(selectedTableId ? [selectedTableId] : []);
    setFormStartTime(undefined);
    reservationFormHandlers.open();
  }, [selectedTableId, reservationFormHandlers]);

  const handleWalkin = useCallback(() => {
    setFormTableIds(selectedTableId ? [selectedTableId] : []);
    walkinFormHandlers.open();
  }, [selectedTableId, walkinFormHandlers]);

  const isToday = selectedDate === dayjs().format('YYYY-MM-DD');

  if (zonesLoading) {
    return (
      <AppLayout>
        <Center h="80vh">
          <Loader size="lg" />
        </Center>
      </AppLayout>
    );
  }

  if (activeZones.length === 0) {
    return (
      <AppLayout>
        <Center h="80vh">
          <Text size="lg" c="dimmed">
            Nema aktivnih zona. Kreirajte zonu u admin panelu.
          </Text>
        </Center>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Stack h="calc(100vh - 48px - 16px)" gap={0}>
        <Group justify="space-between" wrap="nowrap" px={isMobile ? 'sm' : 4} py={isMobile ? 8 : 4} style={{ flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <Group gap={isMobile ? 8 : 4} align="center">
            <ActionIcon
              variant="subtle"
              size={isMobile ? 'md' : 'sm'}
              onClick={goToPrevDay}
              aria-label="Prethodni dan"
            >
              <IconChevronLeft size={isMobile ? 20 : 16} />
            </ActionIcon>

            <Text
              fw={700}
              size={isMobile ? 'md' : 'sm'}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={goToToday}
              title="Klikni za danas"
            >
              {isMobile ? formatDateSrShort(selectedDate) : formatDateSr(selectedDate)}
            </Text>

            <ActionIcon
              variant="subtle"
              size={isMobile ? 'md' : 'sm'}
              onClick={goToNextDay}
              aria-label="Sledeci dan"
            >
              <IconChevronRight size={isMobile ? 20 : 16} />
            </ActionIcon>

            {!isToday && (
              <Button
                variant="subtle"
                size={isMobile ? 'compact-sm' : 'compact-xs'}
                onClick={goToToday}
              >
                Danas
              </Button>
            )}
          </Group>

          {/* Mobile view toggle */}
          {isMobile && (
            <SegmentedControl
              size="xs"
              value={mobileView}
              onChange={(v) => setMobileView(v as 'agenda' | 'timeline')}
              data={[
                { value: 'agenda', label: 'Lista' },
                { value: 'timeline', label: 'Timeline' },
              ]}
            />
          )}

          {/* Desktop-only inline buttons */}
          <Group gap={4} visibleFrom="sm">
            <Button
              size="compact-sm"
              leftSection={<IconPlus size={14} />}
              onClick={handleNewReservation}
            >
              Nova rezervacija
            </Button>
            <Button
              variant="outline"
              size="compact-sm"
              leftSection={<IconWalk size={14} />}
              onClick={handleWalkin}
            >
              Walk-in
            </Button>
          </Group>
        </Group>

        {/* Search bar — always visible */}
        <Box px={isMobile ? 'sm' : 4} pt={isMobile ? 'sm' : 4} pb={isMobile ? 6 : 4} style={{ flexShrink: 0 }}>
          <TextInput
            placeholder="Pretraži gosta, telefon, sto..."
            leftSection={<IconSearch size={isMobile ? 18 : 14} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            size={isMobile ? 'md' : 'sm'}
            styles={isMobile ? { input: { fontSize: 16 } } : undefined}
          />
        </Box>

        <div style={{ flex: 1, overflow: 'hidden', padding: isMobile && mobileView === 'agenda' ? 0 : '4px 4px 0' }}>
          {isMobile && mobileView === 'agenda' ? (
            <MobileAgendaView
              date={selectedDate}
              search={search}
              onViewReservation={handleTimelineView}
            />
          ) : (
            <TimelineGrid
              date={selectedDate}
              search={search}
              onCreateReservation={handleTimelineCreate}
              onViewReservation={handleTimelineView}
            />
          )}
        </div>
      </Stack>

      {/* Mobile FAB */}
      {isMobile && (
        <MobileFAB
          onNewReservation={handleNewReservation}
          onWalkin={handleWalkin}
        />
      )}

      <ReservationDrawer
        reservation={viewingReservation}
        opened={drawerOpened}
        onClose={() => {
          drawerHandlers.close();
          setViewingReservation(null);
        }}
        onEdit={handleEditFromDrawer}
      />

      <ReservationForm
        opened={reservationFormOpened}
        onClose={() => {
          setFormStartTime(undefined);
          setEditingReservation(undefined);
          reservationFormHandlers.close();
        }}
        tableIds={formTableIds}
        date={selectedDate}
        startTime={formStartTime}
        reservation={editingReservation}
      />
      <WalkinForm
        opened={walkinFormOpened}
        onClose={walkinFormHandlers.close}
        tableIds={formTableIds}
      />
    </AppLayout>
  );
}
