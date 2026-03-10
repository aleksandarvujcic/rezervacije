import { Group, Select, NumberInput } from '@mantine/core';
import type { Zone } from '../../api/types';

interface TimelineFiltersProps {
  zones: Zone[];
  selectedZoneId: number | null;
  onZoneChange: (zoneId: number | null) => void;
  minCapacity: number | '';
  onMinCapacityChange: (value: number | '') => void;
}

export function TimelineFilters({
  zones,
  selectedZoneId,
  onZoneChange,
  minCapacity,
  onMinCapacityChange,
}: TimelineFiltersProps) {
  const zoneOptions = [
    { value: '', label: 'Sve zone' },
    ...zones.map((z) => ({ value: String(z.id), label: z.name })),
  ];

  return (
    <Group gap={4} wrap="nowrap">
      <Select
        size="xs"
        w={120}
        placeholder="Zona"
        data={zoneOptions}
        value={selectedZoneId ? String(selectedZoneId) : ''}
        onChange={(v) => onZoneChange(v ? Number(v) : null)}
        clearable
        styles={{ input: { height: 26, minHeight: 26 } }}
      />
      <NumberInput
        size="xs"
        w={80}
        placeholder="Min."
        min={1}
        max={20}
        value={minCapacity}
        onChange={(v) => onMinCapacityChange(typeof v === 'number' ? v : '')}
        styles={{ input: { height: 26, minHeight: 26 } }}
      />
    </Group>
  );
}
