import { useState, useMemo } from 'react';
import {
  Drawer,
  Stack,
  Group,
  Text,
  Title,
  Badge,
  Divider,
  Button,
  ActionIcon,
  Paper,
  Box,
  Select,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  IconUser,
  IconPhone,
  IconUsers,
  IconCalendar,
  IconClock,
  IconArmchair,
  IconFlag,
  IconX,
  IconAlertCircle,
  IconHourglass,
  IconEdit,
  IconTrash,
  IconCheck,
  IconNotes,
  IconToolsKitchen2,
} from '@tabler/icons-react';
import type { Reservation, ReservationStatus, ReservationType } from '../../api/types';
import { StatusBadge } from '../common/StatusBadge';
import { useUpdateReservation, useDeleteReservation } from '../../hooks/useReservations';
import { VALID_TRANSITIONS, STATUS_ACTION_LABELS } from '../../config/statusConfig';
import { workingHoursApi } from '../../api/endpoints';

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
  waitlist: { icon: IconClock, color: 'yellow' },
  odlozena: { icon: IconHourglass, color: 'blue' },
};

interface ReservationDrawerProps {
  reservation: Reservation | null;
  opened: boolean;
  onClose: () => void;
  onEdit: (reservation: Reservation) => void;
}

export function ReservationDrawer({
  reservation,
  opened,
  onClose,
  onEdit,
}: ReservationDrawerProps) {
  const updateMutation = useUpdateReservation();
  const deleteMutation = useDeleteReservation();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [postponeTime, setPostponeTime] = useState<string | null>(null);
  const [showPostpone, setShowPostpone] = useState(false);

  const { data: workingHours } = useQuery({
    queryKey: ['working-hours'],
    queryFn: () => workingHoursApi.get(),
  });

  // Generate time slots after current reservation time
  const laterTimeSlots = useMemo(() => {
    if (!reservation) return [];
    const currentTime = reservation.start_time.substring(0, 5);
    const dow = dayjs(reservation.date).day();
    const todayHours = workingHours?.find((wh) => wh.day_of_week === dow);
    const closeTime = todayHours?.close_time?.substring(0, 5) ?? '23:00';

    const slots: { value: string; label: string }[] = [];
    let current = dayjs(`2000-01-01 ${currentTime}`).add(30, 'minute');
    const end = dayjs(`2000-01-01 ${closeTime}`);

    while (current.isBefore(end) || current.isSame(end)) {
      const t = current.format('HH:mm');
      slots.push({ value: t, label: t });
      current = current.add(30, 'minute');
    }
    return slots;
  }, [reservation, workingHours]);

  if (!reservation) return null;

  const formatTime = (time: string) => time.slice(0, 5);
  const nextStatuses = VALID_TRANSITIONS[reservation.status] || [];
  // Separate odlozena from regular status actions
  const regularActions = nextStatuses
    .filter((s) => s !== 'odlozena')
    .map((s) => ({
      status: s,
      label: STATUS_ACTION_LABELS[s],
      icon: STATUS_ICON_MAP[s].icon,
      color: STATUS_ICON_MAP[s].color,
    }));
  const canPostpone = nextStatuses.includes('odlozena');

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
          onClose();
          setShowPostpone(false);
          setPostponeTime(null);
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
      const labels: Record<string, { title: string; body: string; confirm: string }> = {
        otkazana: {
          title: 'Otkazati rezervaciju?',
          body: `Da li ste sigurni da želite da otkažete rezervaciju za ${reservation.guest_name} (${formatTime(reservation.start_time)}, ${reservation.guest_count} gostiju)?`,
          confirm: 'Da, otkaži',
        },
        no_show: {
          title: 'Označiti kao no-show?',
          body: `Da li ste sigurni da želite da označite ${reservation.guest_name} kao no-show? Gost se nije pojavio na vreme (${formatTime(reservation.start_time)}).`,
          confirm: 'Da, no-show',
        },
      };
      const info = labels[newStatus] || { title: 'Potvrdite akciju', body: 'Da li ste sigurni?', confirm: 'Potvrdi' };
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

  const handlePostpone = () => {
    if (!postponeTime) return;
    updateMutation.mutate(
      {
        id: reservation.id,
        data: { status: 'odlozena', start_time: postponeTime },
      },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Rezervacija odložena',
            message: `${reservation.guest_name} pomerena sa ${formatTime(reservation.start_time)} na ${postponeTime}`,
            color: 'green',
            icon: <IconCheck size={18} />,
            autoClose: 4000,
          });
          onClose();
          setShowPostpone(false);
          setPostponeTime(null);
        },
        onError: (error: Error) => {
          notifications.show({
            title: 'Odlaganje nije uspelo',
            message: error.message || 'Moguće je da postoji preklapanje sa drugom rezervacijom u tom terminu.',
            color: 'red',
            icon: <IconX size={18} />,
            autoClose: 6000,
          });
        },
      }
    );
  };

  const handleDelete = () => {
    modals.openConfirmModal({
      title: 'Obrisati rezervaciju?',
      children: (
        <Text size="sm">
          Da li ste sigurni da želite da obrišete rezervaciju za{' '}
          <strong>{reservation.guest_name}</strong> ({formatTime(reservation.start_time)},{' '}
          {reservation.guest_count} gostiju)? Ova akcija se ne može poništiti.
        </Text>
      ),
      labels: { confirm: 'Da, obriši', cancel: 'Odustani' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteMutation.mutate(reservation.id, {
          onSuccess: () => {
            notifications.show({
              title: 'Rezervacija obrisana',
              message: `Rezervacija za ${reservation.guest_name} je uspešno obrisana`,
              color: 'green',
              icon: <IconCheck size={18} />,
              autoClose: 4000,
            });
            onClose();
          },
          onError: (error: Error) => {
            notifications.show({
              title: 'Brisanje nije uspelo',
              message: error.message || 'Došlo je do greške pri brisanju. Pokušajte ponovo.',
              color: 'red',
              icon: <IconX size={18} />,
              autoClose: 6000,
            });
          },
        });
      },
    });
  };

  const isTerminal = ['zavrsena', 'otkazana', 'no_show'].includes(reservation.status);

  return (
    <Drawer
      opened={opened}
      onClose={() => {
        onClose();
        setShowPostpone(false);
        setPostponeTime(null);
      }}
      title={null}
      position={isMobile ? 'bottom' : 'right'}
      size={isMobile ? '85%' : 'sm'}
      padding="md"
      styles={
        isMobile
          ? {
              content: {
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
              },
            }
          : undefined
      }
    >
      {/* Drag handle indicator for mobile */}
      {isMobile && (
        <Box
          mx="auto"
          mb="sm"
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: 'var(--mantine-color-gray-4)',
          }}
        />
      )}

      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs" align="center">
              <Title order={3} size="lg" fw={700}>{reservation.guest_name}</Title>
              <StatusBadge status={reservation.status} />
            </Group>
            <Badge variant="light" color="gray" size="sm" mt={4}>
              {TYPE_LABELS[reservation.reservation_type]}
            </Badge>
          </div>
          <ActionIcon
            variant="subtle"
            color="teal"
            size="lg"
            onClick={() => {
              onClose();
              onEdit(reservation);
            }}
          >
            <IconEdit size={20} />
          </ActionIcon>
        </Group>

        <Divider />

        {/* Info */}
        <div>
          <Text c="dimmed" size="xs" tt="uppercase" fw={600} mb={6}>Detalji</Text>
          <Paper p="md" radius="md" bg="gray.0">
          <Stack gap="sm">
            <Group gap="sm">
              <IconCalendar size={18} color="var(--mantine-color-dimmed)" />
              <Text size="md">{dayjs(reservation.date).format('DD.MM.YYYY')}</Text>
            </Group>
            <Group gap="sm">
              <IconClock size={18} color="var(--mantine-color-dimmed)" />
              <Text size="md">
                {formatTime(reservation.start_time)}
                {reservation.end_time ? ` — ${formatTime(reservation.end_time)}` : ''}
                <Text span c="dimmed" size="sm" ml={6}>
                  ({reservation.duration_minutes} min)
                </Text>
              </Text>
            </Group>
            <Group gap="sm">
              <IconUsers size={18} color="var(--mantine-color-dimmed)" />
              <Text size="md">{reservation.guest_count} gostiju</Text>
            </Group>
            {reservation.guest_phone && (
              <Group gap="sm">
                <IconPhone size={18} color="var(--mantine-color-dimmed)" />
                <Text size="md">{reservation.guest_phone}</Text>
              </Group>
            )}
            <Group gap="sm">
              <IconToolsKitchen2 size={18} color="var(--mantine-color-dimmed)" />
              <Text size="md">
                {reservation.tables.length > 0
                  ? `Sto ${reservation.tables.map((t) => t.table_number).join(', ')}`
                  : 'Bez stola'}
              </Text>
            </Group>
          </Stack>
        </Paper>
        </div>

        {reservation.notes && (
          <Paper p="sm" radius="md" bg="gray.0">
            <Group gap="sm" align="flex-start">
              <IconNotes size={16} color="var(--mantine-color-dimmed)" style={{ marginTop: 2 }} />
              <Text size="sm" style={{ flex: 1 }}>{reservation.notes}</Text>
            </Group>
          </Paper>
        )}

        {reservation.celebration_details && (
          <Paper p="sm" radius="md" bg="pink.0">
            <Group gap="sm" align="flex-start">
              <IconUser size={16} color="var(--mantine-color-pink-6)" style={{ marginTop: 2 }} />
              <Text size="sm" style={{ flex: 1 }}>{reservation.celebration_details}</Text>
            </Group>
          </Paper>
        )}

        {/* Created info */}
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            Kreirana {dayjs(reservation.created_at).format('DD.MM.YYYY [u] HH:mm')}
          </Text>
          {reservation.created_by_name && (
            <Text size="xs" c="dimmed">
              — {reservation.created_by_name}
            </Text>
          )}
        </Group>

        {/* Status actions */}
        {(regularActions.length > 0 || canPostpone) && (
          <>
            <Divider label="Promeni status" labelPosition="center" />
            <Stack gap="sm">
              {regularActions.map((action) => (
                <Button
                  key={action.status}
                  variant="light"
                  color={action.color}
                  size={isMobile ? 'md' : 'sm'}
                  leftSection={<action.icon size={20} />}
                  fullWidth
                  onClick={() => handleStatusChange(action.status)}
                  loading={updateMutation.isPending}
                >
                  {action.label}
                </Button>
              ))}

              {/* Postpone with time picker */}
              {canPostpone && !showPostpone && (
                <Button
                  variant="light"
                  color="teal"
                  size={isMobile ? 'md' : 'sm'}
                  leftSection={<IconHourglass size={20} />}
                  fullWidth
                  onClick={() => setShowPostpone(true)}
                >
                  Odloži
                </Button>
              )}

              {canPostpone && showPostpone && (
                <Paper p="sm" withBorder radius="md">
                  <Stack gap="xs">
                    <Text size="sm" fw={600}>Pomeri na kasnije vreme:</Text>
                    <Select
                      placeholder="Izaberi novo vreme"
                      data={laterTimeSlots}
                      value={postponeTime}
                      onChange={setPostponeTime}
                      leftSection={<IconClock size={14} />}
                      searchable
                    />
                    <Group grow>
                      <Button
                        variant="default"
                        size="compact-sm"
                        onClick={() => {
                          setShowPostpone(false);
                          setPostponeTime(null);
                        }}
                      >
                        Odustani
                      </Button>
                      <Button
                        size="compact-sm"
                        disabled={!postponeTime}
                        onClick={handlePostpone}
                        loading={updateMutation.isPending}
                      >
                        Pomeri na {postponeTime || '...'}
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              )}
            </Stack>
          </>
        )}

        {/* Delete */}
        {!isTerminal && (
          <>
            <Divider />
            <Button
              variant="subtle"
              color="red"
              size={isMobile ? 'md' : 'sm'}
              leftSection={<IconTrash size={18} />}
              fullWidth
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              Obrisi rezervaciju
            </Button>
          </>
        )}
      </Stack>
    </Drawer>
  );
}
