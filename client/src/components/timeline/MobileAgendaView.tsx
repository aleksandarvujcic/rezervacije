import { useMemo } from 'react';
import {
  Stack,
  Group,
  Text,
  Paper,
  Badge,
  ScrollArea,
  Button,
  ActionIcon,
  Menu,
  Box,
} from '@mantine/core';
import {
  IconDots,
  IconClock,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { useTimeline } from '../../hooks/useTimeline';
import { useReservations, useUpdateReservation } from '../../hooks/useReservations';
import { useZones } from '../../hooks/useFloorPlan';
import {
  STATUS_COLORS,
  VALID_TRANSITIONS,
  STATUS_ACTION_LABELS,
} from '../../config/statusConfig';
import type { Reservation, ReservationStatus } from '../../api/types';

interface MobileAgendaViewProps {
  date: string;
  search?: string;
  onViewReservation: (reservationId: number) => void;
}

const PRIMARY_ACTION: Partial<Record<ReservationStatus, ReservationStatus>> = {
  nova: 'seated',
  potvrdjena: 'seated',
  seated: 'zavrsena',
};

const PRIMARY_ACTION_LABEL: Partial<Record<ReservationStatus, string>> = {
  nova: 'Za stolom',
  potvrdjena: 'Za stolom',
  seated: 'Zavrsi',
};

const PRIMARY_ACTION_COLOR: Partial<Record<ReservationStatus, string>> = {
  nova: 'green',
  potvrdjena: 'green',
  seated: 'orange',
};

export function MobileAgendaView({ date, search = '', onViewReservation }: MobileAgendaViewProps) {
  const { data: timelineData } = useTimeline(date);
  const { data: reservations } = useReservations(date);
  const { data: zones } = useZones();
  const updateMutation = useUpdateReservation();

  const now = dayjs();
  const isToday = date === now.format('YYYY-MM-DD');
  const currentTime = now.format('HH:mm');

  // Count free tables per zone (only zones that have tables in timeline data)
  const freeByZone = useMemo(() => {
    if (!timelineData || !zones) return [];
    const activeZones = zones.filter((z) => z.is_active);

    return activeZones
      .map((zone) => {
        const zoneTables = timelineData.filter((e) => e.table.zone_id === zone.id);
        const totalTables = zoneTables.length;
        if (totalTables === 0) return null; // Skip zones with no tables (seasonal/inactive)
        const occupiedNow = zoneTables.filter((entry) =>
          entry.reservations.some((r) => {
            if (r.status !== 'seated' && r.status !== 'potvrdjena') return false;
            const start = r.start_time.substring(0, 5);
            const end = r.end_time.substring(0, 5);
            return isToday ? start <= currentTime && end > currentTime : false;
          })
        ).length;
        return {
          zone,
          free: totalTables - (isToday ? occupiedNow : 0),
          total: totalTables,
        };
      })
      .filter(Boolean) as { zone: (typeof zones)[0]; free: number; total: number }[];
  }, [timelineData, zones, isToday, currentTime]);

  const totalFree = freeByZone.reduce((s, z) => s + z.free, 0);

  // Group reservations into sections
  const { seated, upcoming, later } = useMemo(() => {
    if (!reservations) return { seated: [], upcoming: [], later: [] };

    const q = search.trim().toLowerCase();
    const active = reservations.filter((r) => {
      if (['zavrsena', 'otkazana', 'no_show'].includes(r.status)) return false;
      if (q) {
        const tables = r.tables.map((t) => String(t.table_number)).join(' ');
        return (
          r.guest_name.toLowerCase().includes(q) ||
          (r.guest_phone && r.guest_phone.includes(q)) ||
          tables.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const seatedList = active
      .filter((r) => r.status === 'seated')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    const nonSeated = active
      .filter((r) => r.status !== 'seated')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    if (!isToday) {
      return { seated: seatedList, upcoming: nonSeated, later: [] };
    }

    const twoHoursLater = now.add(2, 'hour').format('HH:mm');
    const upcomingList = nonSeated.filter(
      (r) => r.start_time.substring(0, 5) <= twoHoursLater
    );
    const laterList = nonSeated.filter(
      (r) => r.start_time.substring(0, 5) > twoHoursLater
    );

    return { seated: seatedList, upcoming: upcomingList, later: laterList };
  }, [reservations, isToday, now, search]);

  const DANGEROUS_STATUSES: ReservationStatus[] = ['otkazana', 'no_show'];

  const executeStatusChange = (reservation: Reservation, newStatus: ReservationStatus) => {
    updateMutation.mutate(
      { id: reservation.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Status promenjen',
            message: `${reservation.guest_name} → ${STATUS_ACTION_LABELS[newStatus]}`,
            color: 'green',
            icon: <IconCheck size={18} />,
            autoClose: 4000,
          });
        },
        onError: (error: Error) => {
          notifications.show({
            title: 'Greška pri promeni statusa',
            message: error.message || 'Promena statusa nije uspela. Pokušajte ponovo.',
            color: 'red',
            icon: <IconX size={18} />,
            autoClose: 6000,
          });
        },
      }
    );
  };

  const handleStatusChange = (reservation: Reservation, newStatus: ReservationStatus) => {
    if (DANGEROUS_STATUSES.includes(newStatus)) {
      const confirmInfo: Record<string, { title: string; body: string; confirm: string }> = {
        otkazana: {
          title: 'Otkazati rezervaciju?',
          body: `Otkazati rezervaciju za ${reservation.guest_name} (${reservation.start_time.substring(0, 5)}, ${reservation.guest_count} gostiju)?`,
          confirm: 'Da, otkaži',
        },
        no_show: {
          title: 'Označiti kao no-show?',
          body: `Označiti ${reservation.guest_name} kao no-show?`,
          confirm: 'Da, no-show',
        },
      };
      const info = confirmInfo[newStatus]!;
      modals.openConfirmModal({
        title: info.title,
        children: <Text size="sm">{info.body}</Text>,
        labels: { confirm: info.confirm, cancel: 'Odustani' },
        confirmProps: { color: 'red' },
        onConfirm: () => executeStatusChange(reservation, newStatus),
      });
    } else {
      executeStatusChange(reservation, newStatus);
    }
  };

  return (
    <Stack gap={0} h="100%">
      {/* Free tables strip */}
      <Paper px="sm" py={8} style={{ borderBottom: '1px solid var(--mantine-color-gray-3)', flexShrink: 0 }}>
        <Group gap="xs" justify="space-between" wrap="nowrap">
          <Text size="md" fw={600}>
            {totalFree} slobodn{totalFree === 1 ? 'o' : 'ih'}
          </Text>
          <ScrollArea type="never" offsetScrollbars={false}>
            <Group gap={6} wrap="nowrap">
              {freeByZone.map(({ zone, free, total }) => (
                <Badge
                  key={zone.id}
                  variant="light"
                  size="md"
                  style={{ flexShrink: 0 }}
                >
                  {zone.name}: {free}/{total}
                </Badge>
              ))}
            </Group>
          </ScrollArea>
        </Group>
      </Paper>

      {/* Scrollable sections */}
      <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
        <Stack gap="md" p="sm">
          {/* Seated section */}
          {seated.length > 0 && (
            <Section title="Sada" count={seated.length}>
              {seated.map((r) => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
                  date={date}
                  isToday={isToday}
                  onTap={() => onViewReservation(r.id)}
                  onPrimaryAction={() => {
                    const next = PRIMARY_ACTION[r.status];
                    if (next) handleStatusChange(r, next);
                  }}
                  onSecondaryAction={(status) => {
                    if (status === 'odlozena') {
                      onViewReservation(r.id);
                    } else {
                      handleStatusChange(r, status);
                    }
                  }}
                />
              ))}
            </Section>
          )}

          {/* Upcoming section */}
          {upcoming.length > 0 && (
            <Section title={isToday ? 'Sledece' : 'Rezervacije'} count={upcoming.length}>
              {upcoming.map((r) => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
                  date={date}
                  isToday={isToday}
                  onTap={() => onViewReservation(r.id)}
                  onPrimaryAction={() => {
                    const next = PRIMARY_ACTION[r.status];
                    if (next) handleStatusChange(r, next);
                  }}
                  onSecondaryAction={(status) => {
                    if (status === 'odlozena') {
                      onViewReservation(r.id);
                    } else {
                      handleStatusChange(r, status);
                    }
                  }}
                />
              ))}
            </Section>
          )}

          {/* Later section */}
          {later.length > 0 && (
            <Section title="Kasnije" count={later.length}>
              {later.map((r) => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
                  date={date}
                  isToday={isToday}
                  onTap={() => onViewReservation(r.id)}
                  onPrimaryAction={() => {
                    const next = PRIMARY_ACTION[r.status];
                    if (next) handleStatusChange(r, next);
                  }}
                  onSecondaryAction={(status) => {
                    if (status === 'odlozena') {
                      onViewReservation(r.id);
                    } else {
                      handleStatusChange(r, status);
                    }
                  }}
                />
              ))}
            </Section>
          )}

          {seated.length === 0 && upcoming.length === 0 && later.length === 0 && (
            <Text c="dimmed" ta="center" py="xl" size="md">
              {search ? 'Nema rezultata pretrage' : 'Nema aktivnih rezervacija za ovaj dan'}
            </Text>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Group gap="xs" mb={8}>
        <Text size="sm" fw={700} tt="uppercase" c="dimmed">
          {title}
        </Text>
        <Badge size="sm" variant="light" color="gray" circle>
          {count}
        </Badge>
      </Group>
      <Stack gap={8}>{children}</Stack>
    </div>
  );
}

function ReservationCard({
  reservation,
  date,
  isToday,
  onTap,
  onPrimaryAction,
  onSecondaryAction,
}: {
  reservation: Reservation;
  date: string;
  isToday: boolean;
  onTap: () => void;
  onPrimaryAction: () => void;
  onSecondaryAction: (status: ReservationStatus) => void;
}) {
  const r = reservation;
  const formatTime = (t: string) => t.substring(0, 5);
  const primaryLabel = PRIMARY_ACTION_LABEL[r.status];
  const primaryColor = PRIMARY_ACTION_COLOR[r.status];
  const secondaryStatuses = (VALID_TRANSITIONS[r.status] || []).filter(
    (s) => s !== PRIMARY_ACTION[r.status]
  );

  // Remaining time for seated
  let remainingMin: number | null = null;
  if (r.status === 'seated' && isToday) {
    const endStr = r.end_time
      ? r.end_time.substring(0, 5)
      : dayjs(`${date} ${r.start_time}`)
          .add(r.duration_minutes, 'minute')
          .format('HH:mm');
    const end = dayjs(`${date} ${endStr}`);
    remainingMin = end.diff(dayjs(), 'minute');
    if (remainingMin < 0) remainingMin = 0;
  }

  const tables = r.tables.map((t) => t.table_number).join(', ') || '-';

  return (
    <Paper
      p="sm"
      style={{
        cursor: 'pointer',
        minHeight: 56,
        borderLeft: `4px solid ${STATUS_COLORS[r.status]}`,
      }}
      onClick={onTap}
    >
      <Group justify="space-between" wrap="nowrap" gap="sm">
        {/* Left: time + table */}
        <Box style={{ flexShrink: 0, width: 56 }}>
          <Text size="md" fw={700} lh={1.2}>
            {formatTime(r.start_time)}
          </Text>
          <Text size="sm" c="dimmed" lh={1.3}>
            Sto {tables}
          </Text>
        </Box>

        {/* Center: guest info */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="md" fw={500} truncate="end" lh={1.2}>
            {r.guest_name}
          </Text>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" c="dimmed" lh={1.3}>
              {r.guest_count} gostiju
            </Text>
            {remainingMin !== null && (
              <Badge
                size="sm"
                variant="light"
                color={remainingMin <= 15 ? 'red' : remainingMin <= 30 ? 'orange' : 'gray'}
                leftSection={<IconClock size={12} />}
              >
                {remainingMin}m
              </Badge>
            )}
          </Group>
        </Box>

        {/* Right: primary action + menu */}
        <Group gap={6} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          {primaryLabel && (
            <Button
              size="compact-sm"
              variant="light"
              color={primaryColor}
              onClick={onPrimaryAction}
            >
              {primaryLabel}
            </Button>
          )}
          {secondaryStatuses.length > 0 && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" size="md">
                  <IconDots size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {secondaryStatuses.map((s) => (
                  <Menu.Item
                    key={s}
                    onClick={() => onSecondaryAction(s)}
                  >
                    {STATUS_ACTION_LABELS[s]}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Group>
    </Paper>
  );
}
