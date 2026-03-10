import {
  Stack,
  Text,
  Group,
  Button,
  Divider,
  Paper,
  Title,
  Badge,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconEdit,
  IconCheck,
  IconArmchair,
  IconFlag,
  IconX,
  IconAlertCircle,
  IconClock,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { Reservation, ReservationStatus, ReservationType } from '../../api/types';
import { StatusBadge } from '../common/StatusBadge';
import { useUpdateReservation } from '../../hooks/useReservations';
import { VALID_TRANSITIONS, STATUS_ACTION_LABELS } from '../../config/statusConfig';

const TYPE_LABELS: Record<ReservationType, string> = {
  standard: 'Standard',
  celebration: 'Proslava',
  walkin: 'Walk-in',
};

const STATUS_ICON_MAP: Record<ReservationStatus, { icon: typeof IconCheck; color: string }> = {
  nova: { icon: IconCheck, color: 'blue' },
  potvrdjena: { icon: IconCheck, color: 'blue' },
  seated: { icon: IconArmchair, color: 'orange' },
  zavrsena: { icon: IconFlag, color: 'green' },
  otkazana: { icon: IconX, color: 'red' },
  no_show: { icon: IconAlertCircle, color: 'red' },
  waitlist: { icon: IconCheck, color: 'blue' },
  odlozena: { icon: IconClock, color: 'violet' },
};

interface ReservationDetailProps {
  reservation: Reservation;
  onEdit?: (reservation: Reservation) => void;
}

export function ReservationDetail({
  reservation,
  onEdit,
}: ReservationDetailProps) {
  const updateMutation = useUpdateReservation();

  const DANGEROUS_STATUSES: ReservationStatus[] = ['otkazana', 'no_show'];

  const executeStatusChange = (newStatus: ReservationStatus) => {
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

  const handleStatusChange = (newStatus: ReservationStatus) => {
    if (DANGEROUS_STATUSES.includes(newStatus)) {
      const confirmInfo: Record<string, { title: string; body: string; confirm: string }> = {
        otkazana: {
          title: 'Otkazati rezervaciju?',
          body: `Otkazati rezervaciju za ${reservation.guest_name}?`,
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
        onConfirm: () => executeStatusChange(newStatus),
      });
    } else {
      executeStatusChange(newStatus);
    }
  };

  const nextStatuses = VALID_TRANSITIONS[reservation.status] || [];
  const actions = nextStatuses.map((s) => ({
    status: s,
    label: STATUS_ACTION_LABELS[s],
    icon: STATUS_ICON_MAP[s].icon,
    color: STATUS_ICON_MAP[s].color,
  }));
  const formatTime = (time: string) => time.slice(0, 5);

  return (
    <Paper p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={4}>{reservation.guest_name}</Title>
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconEdit size={14} />}
            onClick={() => onEdit?.(reservation)}
          >
            Izmeni
          </Button>
        </Group>

        <Group gap="xs">
          <StatusBadge status={reservation.status} />
          <Badge variant="light" color="gray">
            {TYPE_LABELS[reservation.reservation_type]}
          </Badge>
        </Group>

        <Divider />

        <Stack gap="xs">
          <DetailRow label="Datum" value={dayjs(reservation.date).format('DD.MM.YYYY')} />
          <DetailRow
            label="Vreme"
            value={`${formatTime(reservation.start_time)}${reservation.end_time ? ` - ${formatTime(reservation.end_time)}` : ''}`}
          />
          <DetailRow
            label="Trajanje"
            value={`${reservation.duration_minutes} min`}
          />
          <DetailRow
            label="Broj gostiju"
            value={String(reservation.guest_count)}
          />
          {reservation.guest_phone && (
            <DetailRow label="Telefon" value={reservation.guest_phone} />
          )}
          <DetailRow
            label="Stolovi"
            value={
              reservation.tables.length > 0
                ? reservation.tables.map((t) => t.table_number).join(', ')
                : 'Bez stola'
            }
          />
          {reservation.notes && (
            <DetailRow label="Napomene" value={reservation.notes} />
          )}
          {reservation.celebration_details && (
            <DetailRow
              label="Detalji proslave"
              value={reservation.celebration_details}
            />
          )}
          <DetailRow
            label="Kreirana"
            value={`${dayjs(reservation.created_at).format('DD.MM.YYYY [u] HH:mm')}${reservation.created_by_name ? ` — ${reservation.created_by_name}` : ''}`}
          />
        </Stack>

        {actions.length > 0 && (
          <>
            <Divider />
            <Group gap="xs">
              {actions.map((action) => (
                <Button
                  key={action.status}
                  size="xs"
                  variant="light"
                  color={action.color}
                  leftSection={<action.icon size={14} />}
                  onClick={() => handleStatusChange(action.status)}
                  loading={updateMutation.isPending}
                >
                  {action.label}
                </Button>
              ))}
            </Group>
          </>
        )}
      </Stack>
    </Paper>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="xs">
      <Text size="sm" c="dimmed" w={110}>
        {label}:
      </Text>
      <Text size="sm">{value}</Text>
    </Group>
  );
}
