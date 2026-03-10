import { Badge } from '@mantine/core';
import type { ReservationStatus } from '../../api/types';
import { STATUS_COLORS, STATUS_LABELS } from '../../config/statusConfig';

interface StatusBadgeProps {
  status: ReservationStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge
      color={STATUS_COLORS[status]}
      variant="light"
      size="sm"
      leftSection={
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: STATUS_COLORS[status],
            display: 'inline-block',
          }}
        />
      }
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
