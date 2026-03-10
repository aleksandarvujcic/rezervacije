import { Menu, Box } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { Reservation, ReservationStatus } from '../../api/types';
import { StatusBadge } from '../common/StatusBadge';
import { useUpdateReservation } from '../../hooks/useReservations';
import { VALID_TRANSITIONS, STATUS_ACTION_LABELS, STATUS_COLORS } from '../../config/statusConfig';

interface StatusChangeMenuProps {
  reservation: Reservation;
  onStatusChange?: (newStatus: ReservationStatus) => void;
}

// Statuses that require confirmation before applying
const CONFIRM_STATUSES: Set<ReservationStatus> = new Set(['otkazana', 'no_show']);

export function StatusChangeMenu({
  reservation,
  onStatusChange,
}: StatusChangeMenuProps) {
  const updateMutation = useUpdateReservation();
  const nextStatuses = VALID_TRANSITIONS[reservation.status] || [];

  const doChange = (newStatus: ReservationStatus) => {
    updateMutation.mutate(
      { id: reservation.id, data: { status: newStatus } },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Status promenjen',
            message: `Rezervacija za ${reservation.guest_name} je sada "${STATUS_ACTION_LABELS[newStatus]}"`,
            color: 'green',
          });
          onStatusChange?.(newStatus);
        },
        onError: (error: Error) => {
          notifications.show({
            title: 'Greška',
            message: error.message || 'Promena statusa nije uspela',
            color: 'red',
          });
        },
      }
    );
  };

  const handleStatusChange = (newStatus: ReservationStatus) => {
    // S2: Confirmation dialog for destructive status changes
    if (CONFIRM_STATUSES.has(newStatus)) {
      modals.openConfirmModal({
        title: 'Potvrda promene statusa',
        children: `Da li ste sigurni da želite da promenite status rezervacije za ${reservation.guest_name} u "${STATUS_ACTION_LABELS[newStatus]}"?`,
        labels: { confirm: 'Da, promeni', cancel: 'Otkaži' },
        confirmProps: { color: newStatus === 'otkazana' ? 'red' : 'orange' },
        onConfirm: () => doChange(newStatus),
      });
    } else {
      doChange(newStatus);
    }
  };

  if (nextStatuses.length === 0) {
    return <StatusBadge status={reservation.status} />;
  }

  return (
    <Menu shadow="md" width={180} position="bottom-start">
      <Menu.Target>
        <span style={{ cursor: 'pointer' }}>
          <StatusBadge status={reservation.status} />
        </span>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Promeni status</Menu.Label>
        {nextStatuses.map((status) => {
          const isDestructive = status === 'otkazana' || status === 'no_show';
          return (
            <Menu.Item
              key={status}
              onClick={() => handleStatusChange(status)}
              color={isDestructive ? 'red' : undefined}
              leftSection={
                <Box
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: STATUS_COLORS[status],
                  }}
                />
              }
            >
              {STATUS_ACTION_LABELS[status]}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
