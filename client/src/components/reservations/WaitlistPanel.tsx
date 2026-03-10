import {
  Stack,
  Text,
  Card,
  Group,
  Button,
  Center,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArmchair, IconX } from '@tabler/icons-react';
import type { Reservation } from '../../api/types';
import { useReservations, useUpdateReservation } from '../../hooks/useReservations';

interface WaitlistPanelProps {
  date: string;
  onAssignTable?: (reservation: Reservation) => void;
}

export function WaitlistPanel({ date, onAssignTable }: WaitlistPanelProps) {
  const { data: waitlistReservations, isLoading } = useReservations(
    date,
    'waitlist'
  );
  const updateMutation = useUpdateReservation();

  const handleCancel = (reservation: Reservation) => {
    updateMutation.mutate(
      { id: reservation.id, data: { status: 'otkazana' } },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Otkazano',
            message: `Rezervacija za ${reservation.guest_name} je otkazana`,
            color: 'green',
          });
        },
        onError: () => {
          notifications.show({
            title: 'Greska',
            message: 'Otkazivanje nije uspelo',
            color: 'red',
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Center py="md">
        <Loader size="sm" />
      </Center>
    );
  }

  if (!waitlistReservations || waitlistReservations.length === 0) {
    return (
      <Center py="md">
        <Text c="dimmed" size="sm">
          Nema gostiju na listi cekanja
        </Text>
      </Center>
    );
  }

  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        Lista cekanja ({waitlistReservations.length})
      </Text>
      {waitlistReservations.map((r) => (
        <Card key={r.id} withBorder padding="xs">
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text fw={500} size="sm">
                {r.guest_name}
              </Text>
              <Text size="xs" c="dimmed">
                {r.guest_count} gostiju &middot; {r.start_time.slice(0, 5)}
              </Text>
            </div>
            <Group gap="xs" wrap="nowrap">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconArmchair size={14} />}
                onClick={() => onAssignTable?.(r)}
              >
                Dodeli sto
              </Button>
              <Button
                size="xs"
                variant="light"
                color="red"
                leftSection={<IconX size={14} />}
                onClick={() => handleCancel(r)}
                loading={updateMutation.isPending}
              >
                Otkazi
              </Button>
            </Group>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
