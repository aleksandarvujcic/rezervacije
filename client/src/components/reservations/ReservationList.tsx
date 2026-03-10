import { useState, useMemo } from 'react';
import {
  Table,
  Text,
  ActionIcon,
  Group,
  Tooltip,
  Center,
  Loader,
  Badge,
  Stack,
  Button,
  Paper,
  Box,
} from '@mantine/core';
import { IconEdit, IconPlus, IconClock, IconChevronRight } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { Reservation, ReservationType } from '../../api/types';
import { useReservations } from '../../hooks/useReservations';
import { StatusChangeMenu } from './StatusChangeMenu';
import { StatusBadge } from '../common/StatusBadge';
import { STATUS_COLORS } from '../../config/statusConfig';

const TYPE_LABELS: Record<ReservationType, string> = {
  standard: 'Standard',
  celebration: 'Proslava',
  walkin: 'Walk-in',
};

interface ReservationListProps {
  date: string;
  zoneId?: number;
  status?: string;
  /** Pre-filtered reservations. When provided, the component skips its own query. */
  reservations?: Reservation[];
  onEdit?: (reservation: Reservation) => void;
  onSelect?: (reservation: Reservation) => void;
  onCreateNew?: () => void;
}

export function ReservationList({
  date,
  zoneId,
  status,
  reservations: externalData,
  onEdit,
  onSelect,
  onCreateNew,
}: ReservationListProps) {
  const skipQuery = externalData !== undefined;
  const { data: fetchedData, isLoading } = useReservations(
    skipQuery ? undefined : date,
    skipQuery ? undefined : status,
    skipQuery ? undefined : zoneId
  );

  const reservations = externalData ?? fetchedData;
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(() => {
    if (!reservations) return [];
    return [...reservations].sort((a, b) => {
      const cmp = a.start_time.localeCompare(b.start_time);
      return sortAsc ? cmp : -cmp;
    });
  }, [reservations, sortAsc]);

  if (!skipQuery && isLoading) {
    return (
      <Center py="xl">
        <Loader size="md" />
      </Center>
    );
  }

  if (!sorted.length) {
    return (
      <Center py="xl">
        <Stack align="center" gap="sm">
          <Text c="dimmed">Nema rezervacija za izabrani datum</Text>
          {onCreateNew && (
            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={onCreateNew}
            >
              Kreiraj prvu rezervaciju
            </Button>
          )}
        </Stack>
      </Center>
    );
  }

  const formatTime = (time: string) => time.slice(0, 5);

  return (
    <>
      {/* Desktop table view */}
      <Box visibleFrom="sm">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setSortAsc((v) => !v)}
              >
                Vreme {sortAsc ? '\u25B2' : '\u25BC'}
              </Table.Th>
              <Table.Th>Gost</Table.Th>
              <Table.Th>Br. gostiju</Table.Th>
              <Table.Th>Stolovi</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Tip</Table.Th>
              <Table.Th>Akcije</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sorted.map((r) => (
              <Table.Tr
                key={r.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect?.(r)}
              >
                <Table.Td>
                  {formatTime(r.start_time)}
                  {r.end_time ? ` - ${formatTime(r.end_time)}` : ''}
                </Table.Td>
                <Table.Td fw={500}>{r.guest_name}</Table.Td>
                <Table.Td>{r.guest_count}</Table.Td>
                <Table.Td>
                  {r.tables.map((t) => t.table_number).join(', ') || '-'}
                </Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Group gap={4} wrap="nowrap">
                    <StatusChangeMenu reservation={r} />
                    <RemainingTime reservation={r} date={date} />
                  </Group>
                </Table.Td>
                <Table.Td>{TYPE_LABELS[r.reservation_type]}</Table.Td>
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Group gap="xs">
                    <Tooltip label="Izmeni">
                      <ActionIcon
                        variant="subtle"
                        size="sm"
                        onClick={() => onEdit?.(r)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>

      {/* Mobile card view */}
      <Box hiddenFrom="sm">
        <Stack gap="sm">
          {sorted.map((r) => (
            <Paper
              key={r.id}
              p="sm"
              style={{
                cursor: 'pointer',
                minHeight: 64,
                borderLeft: `3px solid ${STATUS_COLORS[r.status]}`,
              }}
              onClick={() => onSelect?.(r)}
            >
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Box style={{ flexShrink: 0, width: 56 }}>
                  <Text size="md" fw={700} lh={1.2}>
                    {formatTime(r.start_time)}
                  </Text>
                  <Text size="sm" c="dimmed" lh={1.3}>
                    {r.tables.map((t) => t.table_number).join(', ') || '-'}
                  </Text>
                </Box>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="md" fw={500} truncate="end" lh={1.2}>
                    {r.guest_name}
                  </Text>
                  <Group gap={6}>
                    <Badge size="xs" variant="light" color="gray">{r.guest_count} gostiju</Badge>
                    <RemainingTime reservation={r} date={date} />
                  </Group>
                </Box>
                <Group gap={6} wrap="nowrap">
                  <StatusBadge status={r.status} />
                  <IconChevronRight size={18} color="var(--mantine-color-gray-5)" />
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Box>
    </>
  );
}

/** Shows remaining time indicator for seated reservations */
function RemainingTime({ reservation, date }: { reservation: Reservation; date: string }) {
  if (reservation.status !== 'seated') return null;

  const now = dayjs();
  const isToday = date === now.format('YYYY-MM-DD');
  if (!isToday) return null;

  const endTime = reservation.end_time
    ? reservation.end_time.substring(0, 5)
    : dayjs(`${date} ${reservation.start_time}`)
        .add(reservation.duration_minutes, 'minute')
        .format('HH:mm');

  const end = dayjs(`${date} ${endTime}`);
  const minsLeft = end.diff(now, 'minute');

  if (minsLeft <= 0) return null;

  const color = minsLeft <= 15 ? 'red' : minsLeft <= 30 ? 'orange' : 'gray';

  return (
    <Tooltip label={`Preostalo: ${minsLeft} min (do ${endTime})`}>
      <Badge size="xs" variant="light" color={color} leftSection={<IconClock size={10} />}>
        {minsLeft}m
      </Badge>
    </Tooltip>
  );
}
