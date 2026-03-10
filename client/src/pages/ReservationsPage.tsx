import { useState, useMemo } from 'react';
import {
  Title,
  Group,
  Button,
  Select,
  MultiSelect,
  Stack,
  Paper,
  Text,
  Drawer,
  Loader,
  Center,
  NumberInput,
  SimpleGrid,
  ThemeIcon,
  Collapse,
  Box,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import {
  IconPlus,
  IconWalk,
  IconList,
  IconUsers,
  IconCalendarEvent,
  IconArmchair,
  IconFilter,
  IconSearch,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { AppLayout } from '../components/layout/AppLayout';
import { ReservationList } from '../components/reservations/ReservationList';
import { ReservationForm } from '../components/reservations/ReservationForm';
import { WalkinForm } from '../components/reservations/WalkinForm';
import { WaitlistPanel } from '../components/reservations/WaitlistPanel';
import { ReservationDetail } from '../components/reservations/ReservationDetail';
import { MobileFAB } from '../components/layout/MobileFAB';
import { zonesApi } from '../api/endpoints';
import { useReservations } from '../hooks/useReservations';
import { STATUS_OPTIONS } from '../config/statusConfig';
import type { Reservation, ReservationStatus } from '../api/types';
import { useHasPermission } from '../hooks/usePermissions';

export function ReservationsPage() {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const hasPermission = useHasPermission();
  const canCreateReservation = hasPermission('create_reservation');
  const canCreateWalkin = hasPermission('create_walkin');

  // Date & filters
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [minGuests, setMinGuests] = useState<number | ''>('');
  const [timeFrom, setTimeFrom] = useState<string | null>(null);
  const [timeTo, setTimeTo] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filtersExpanded, filtersHandlers] = useDisclosure(false);

  // Modals
  const [reservationFormOpened, reservationFormHandlers] = useDisclosure(false);
  const [walkinFormOpened, walkinFormHandlers] = useDisclosure(false);
  const [waitlistDrawerOpened, waitlistDrawerHandlers] = useDisclosure(false);

  // Detail panel
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [detailDrawerOpened, detailDrawerHandlers] = useDisclosure(false);

  // Edit mode
  const [editReservation, setEditReservation] = useState<Reservation | undefined>(undefined);

  // Zones for filter
  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => zonesApi.list(),
  });

  const zoneOptions = useMemo(
    () => [
      { value: '', label: 'Sve zone' },
      ...(zones?.map((z) => ({ value: String(z.id), label: z.name })) || []),
    ],
    [zones]
  );

  // Time filter options
  const timeFilterOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let h = 9; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        opts.push({ value: t, label: t });
      }
    }
    return opts;
  }, []);

  const dateStr = selectedDate ? dayjs(selectedDate).format('YYYY-MM-DD') : '';

  const { data: allReservations, isLoading: reservationsLoading } = useReservations(
    dateStr,
    undefined,
    zoneFilter ? Number(zoneFilter) : undefined
  );

  // Summary stats
  const stats = useMemo(() => {
    if (!allReservations) return null;
    const total = allReservations.length;
    const byStatus: Partial<Record<ReservationStatus, number>> = {};
    let totalGuests = 0;
    let seatedCount = 0;
    for (const r of allReservations) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      totalGuests += r.guest_count;
      if (r.status === 'seated') seatedCount++;
    }
    const activeCount = allReservations.filter(
      (r) => !['otkazana', 'no_show', 'zavrsena'].includes(r.status)
    ).length;
    return { total, byStatus, totalGuests, seatedCount, activeCount };
  }, [allReservations]);

  // Client-side filtering
  const displayReservations = useMemo(() => {
    if (!allReservations) return [];
    let filtered = allReservations;

    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((r) => {
        const tables = r.tables.map((t) => String(t.table_number)).join(' ');
        return (
          r.guest_name.toLowerCase().includes(q) ||
          (r.guest_phone && r.guest_phone.includes(q)) ||
          tables.toLowerCase().includes(q)
        );
      });
    }

    if (statusFilters.length > 0) {
      filtered = filtered.filter((r) => statusFilters.includes(r.status));
    }

    if (typeof minGuests === 'number' && minGuests > 1) {
      filtered = filtered.filter((r) => r.guest_count >= minGuests);
    }

    if (timeFrom) {
      filtered = filtered.filter((r) => r.start_time.substring(0, 5) >= timeFrom);
    }

    if (timeTo) {
      filtered = filtered.filter((r) => r.start_time.substring(0, 5) <= timeTo);
    }

    return filtered;
  }, [allReservations, statusFilters, minGuests, timeFrom, timeTo, search]);

  const handleEditReservation = (reservation: Reservation) => {
    setEditReservation(reservation);
    reservationFormHandlers.open();
  };

  const handleSelectReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    detailDrawerHandlers.open();
  };

  const handleAssignTable = (reservation: Reservation) => {
    setEditReservation(reservation);
    waitlistDrawerHandlers.close();
    reservationFormHandlers.open();
  };

  const handleCloseReservationForm = () => {
    setEditReservation(undefined);
    reservationFormHandlers.close();
  };

  const handleNewReservation = () => {
    setEditReservation(undefined);
    reservationFormHandlers.open();
  };

  return (
    <AppLayout>
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <Title order={2}>Rezervacije</Title>
          <Group gap="xs" visibleFrom="sm">
            {canCreateReservation && (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleNewReservation}
              >
                Nova rezervacija
              </Button>
            )}
            {canCreateWalkin && (
              <Button
                variant="light"
                leftSection={<IconWalk size={16} />}
                onClick={walkinFormHandlers.open}
              >
                Walk-in
              </Button>
            )}
            <Button
              variant="subtle"
              leftSection={<IconList size={16} />}
              onClick={waitlistDrawerHandlers.open}
            >
              Lista cekanja
            </Button>
          </Group>
          {/* Mobile: waitlist button only (FAB handles new/walkin) */}
          <Box hiddenFrom="sm">
            <Button
              variant="subtle"
              size="compact-sm"
              leftSection={<IconList size={14} />}
              onClick={waitlistDrawerHandlers.open}
            >
              Cekanje
            </Button>
          </Box>
        </Group>

        {/* Stat cards */}
        {stats && (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            <StatCard
              label="Ukupno"
              value={stats.total}
              icon={<IconCalendarEvent size={18} />}
              color="teal"
            />
            <StatCard
              label="Aktivnih"
              value={stats.activeCount}
              icon={<IconCalendarEvent size={18} />}
              color="green"
            />
            <StatCard
              label="Za stolom"
              value={stats.seatedCount}
              icon={<IconArmchair size={18} />}
              color="orange"
            />
            <StatCard
              label="Ukupno gostiju"
              value={stats.totalGuests}
              icon={<IconUsers size={18} />}
              color="violet"
            />
          </SimpleGrid>
        )}

        {/* Search + Filters */}
        {isMobile && (
          <TextInput
            placeholder="Pretraži gosta, telefon, sto..."
            leftSection={<IconSearch size={18} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            size="md"
            styles={{ input: { fontSize: 16 } }}
          />
        )}
        <Paper p="sm" withBorder>
          {/* Date picker always visible */}
          <Group gap="sm" align="flex-end" wrap="wrap">
            <DatePickerInput
              label={isMobile ? undefined : 'Datum'}
              value={selectedDate}
              onChange={setSelectedDate}
              valueFormat="DD.MM.YYYY"
              size={isMobile ? 'md' : 'sm'}
              w={isMobile ? '100%' : 160}
            />
            {/* Toggle for extra filters on mobile */}
            {isMobile && (
              <Button
                variant="subtle"
                size="compact-sm"
                leftSection={<IconFilter size={16} />}
                onClick={filtersHandlers.toggle}
              >
                Filteri
              </Button>
            )}
            {/* Desktop search */}
            {!isMobile && (
              <TextInput
                placeholder="Pretraži..."
                leftSection={<IconSearch size={14} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                w={200}
              />
            )}
          </Group>

          {/* Extra filters: always visible on desktop, collapsible on mobile */}
          {isMobile ? (
            <Collapse in={filtersExpanded}>
              <SimpleGrid cols={2} spacing="sm" mt="sm">
                <Select
                  label="Zona"
                  data={zoneOptions}
                  value={zoneFilter || ''}
                  onChange={(v) => setZoneFilter(v === '' ? null : v)}
                  clearable
                />
                <MultiSelect
                  label="Status"
                  data={STATUS_OPTIONS}
                  value={statusFilters}
                  onChange={setStatusFilters}
                  placeholder="Svi"
                  clearable
                />
                <NumberInput
                  label="Min. gostiju"
                  min={1}
                  max={50}
                  value={minGuests}
                  onChange={(v) => setMinGuests(typeof v === 'number' ? v : '')}
                  placeholder="1"
                />
                <Select
                  label="Od"
                  data={timeFilterOptions}
                  value={timeFrom}
                  onChange={setTimeFrom}
                  clearable
                  placeholder="Od"
                />
                <Select
                  label="Do"
                  data={timeFilterOptions}
                  value={timeTo}
                  onChange={setTimeTo}
                  clearable
                  placeholder="Do"
                />
              </SimpleGrid>
            </Collapse>
          ) : (
            <Group gap="sm" align="flex-end" wrap="wrap" mt="sm">
              <Select
                label="Zona"
                data={zoneOptions}
                value={zoneFilter || ''}
                onChange={(v) => setZoneFilter(v === '' ? null : v)}
                w={160}
                clearable
              />
              <MultiSelect
                label="Status"
                data={STATUS_OPTIONS}
                value={statusFilters}
                onChange={setStatusFilters}
                placeholder="Svi statusi"
                w={240}
                clearable
              />
              <NumberInput
                label="Min. gostiju"
                min={1}
                max={50}
                w={110}
                value={minGuests}
                onChange={(v) => setMinGuests(typeof v === 'number' ? v : '')}
                placeholder="1"
              />
              <Select
                label="Od"
                data={timeFilterOptions}
                value={timeFrom}
                onChange={setTimeFrom}
                w={100}
                clearable
                placeholder="Od"
              />
              <Select
                label="Do"
                data={timeFilterOptions}
                value={timeTo}
                onChange={setTimeTo}
                w={100}
                clearable
                placeholder="Do"
              />
            </Group>
          )}
        </Paper>

        {/* Reservation List */}
        <Paper p="sm" withBorder>
          {reservationsLoading ? (
            <Center py="xl">
              <Loader size="md" />
            </Center>
          ) : (
            <ReservationList
              date={dateStr}
              reservations={displayReservations}
              onEdit={handleEditReservation}
              onSelect={handleSelectReservation}
            />
          )}
        </Paper>
      </Stack>

      {/* Mobile FAB */}
      {isMobile && (canCreateReservation || canCreateWalkin) && (
        <MobileFAB
          onNewReservation={canCreateReservation ? handleNewReservation : undefined}
          onWalkin={canCreateWalkin ? walkinFormHandlers.open : undefined}
        />
      )}

      {/* Reservation Form Modal */}
      <ReservationForm
        opened={reservationFormOpened}
        onClose={handleCloseReservationForm}
        date={dateStr}
        reservation={editReservation}
      />

      {/* Walk-in Form Modal */}
      <WalkinForm
        opened={walkinFormOpened}
        onClose={walkinFormHandlers.close}
      />

      {/* Waitlist Drawer */}
      <Drawer
        opened={waitlistDrawerOpened}
        onClose={waitlistDrawerHandlers.close}
        title="Lista cekanja"
        position={isMobile ? 'bottom' : 'right'}
        size={isMobile ? '85%' : 'md'}
        styles={
          isMobile
            ? { content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 } }
            : undefined
        }
      >
        <WaitlistPanel
          date={dateStr}
          onAssignTable={handleAssignTable}
        />
      </Drawer>

      {/* Reservation Detail Drawer */}
      <Drawer
        opened={detailDrawerOpened}
        onClose={detailDrawerHandlers.close}
        title="Detalji rezervacije"
        position={isMobile ? 'bottom' : 'right'}
        size={isMobile ? '85%' : 'md'}
        styles={
          isMobile
            ? { content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 } }
            : undefined
        }
      >
        {selectedReservation && (
          <ReservationDetail
            reservation={selectedReservation}
            onEdit={(r) => {
              detailDrawerHandlers.close();
              handleEditReservation(r);
            }}
          />
        )}
      </Drawer>
    </AppLayout>
  );
}

// --- Stat Card ---

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Paper p="sm" shadow="xs">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon size="xl" variant="light" color={color} radius="xl">
          {icon}
        </ThemeIcon>
        <div>
          <Text size="xl" fw={700} lh={1}>
            {value}
          </Text>
          <Text size="xs" c="dimmed">
            {label}
          </Text>
        </div>
      </Group>
    </Paper>
  );
}
