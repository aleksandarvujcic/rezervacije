import { useEffect, useMemo } from 'react';
import {
  Modal,
  TextInput,
  NumberInput,
  Select,
  Button,
  Group,
  Stack,
  Text,
  Paper,
  SimpleGrid,
  UnstyledButton,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import { IconUser, IconUsers, IconClock, IconHourglass, IconCheck, IconX } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useWalkin } from '../../hooks/useReservations';
import { zonesApi, tablesApi, workingHoursApi } from '../../api/endpoints';

interface WalkinFormProps {
  opened: boolean;
  onClose: () => void;
  tableIds?: number[];
}

const DURATION_OPTIONS = [
  { value: '60', label: '1h' },
  { value: '90', label: '1.5h' },
  { value: '120', label: '2h' },
  { value: '150', label: '2.5h' },
  { value: '180', label: '3h' },
];

export function WalkinForm({ opened, onClose, tableIds }: WalkinFormProps) {
  const walkinMutation = useWalkin();
  const isMobile = useMediaQuery('(max-width: 48em)');

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => zonesApi.list(),
  });

  const { data: workingHours } = useQuery({
    queryKey: ['working-hours'],
    queryFn: () => workingHoursApi.get(),
  });

  const tableQueries = useQuery({
    queryKey: ['all-tables', zones?.map((z) => z.id) || []],
    queryFn: async () => {
      if (!zones || zones.length === 0) return [];
      const results = await Promise.all(zones.map((z) => tablesApi.listByZone(z.id)));
      return results.flat();
    },
    enabled: !!zones && zones.length > 0,
  });

  const activeZones = useMemo(
    () => (zones ?? []).filter((z) => z.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [zones]
  );

  const tablesByZone = useMemo(() => {
    const allTables = (tableQueries.data ?? []).filter((t) => t.is_active);
    const grouped: Record<number, typeof allTables> = {};
    for (const t of allTables) {
      if (!grouped[t.zone_id]) grouped[t.zone_id] = [];
      grouped[t.zone_id].push(t);
    }
    for (const zoneId of Object.keys(grouped)) {
      grouped[Number(zoneId)].sort((a, b) => String(a.table_number).localeCompare(String(b.table_number), undefined, { numeric: true }));
    }
    return grouped;
  }, [tableQueries.data]);

  // Time slots from now until close
  const timeSlots = useMemo(() => {
    const now = dayjs();
    const dow = now.day();
    const todayHours = workingHours?.find((wh) => wh.day_of_week === dow);
    const closeTime = todayHours?.close_time?.substring(0, 5) ?? '23:00';

    const slots: { value: string; label: string }[] = [];
    // Start from current time rounded down to nearest 30min
    const startMin = Math.floor(now.minute() / 30) * 30;
    let current = now.hour() * 60 + startMin;
    const [closeH, closeM] = closeTime.split(':').map(Number);
    const endMin = closeH * 60 + closeM;

    while (current <= endMin) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push({ value: t, label: t });
      current += 30;
    }
    return slots;
  }, [workingHours]);

  const form = useForm({
    initialValues: {
      guest_name: '',
      guest_count: 2,
      table_ids: [] as string[],
      start_time: dayjs().format('HH:mm'),
      duration_minutes: '120',
    },
    validate: {
      guest_name: (v) =>
        v.trim().length === 0
          ? 'Ime gosta je obavezno'
          : v.trim().length < 2
            ? 'Ime mora imati najmanje 2 karaktera'
            : null,
      guest_count: (v) =>
        v < 1
          ? 'Broj gostiju mora biti najmanje 1'
          : v > 50
            ? 'Maksimalan broj gostiju je 50'
            : null,
      table_ids: (v) => (v.length === 0 ? 'Izaberite najmanje jedan sto' : null),
      start_time: (v) => (!v ? 'Izaberite vreme' : null),
    },
  });

  const toggleTable = (tableId: number) => {
    const idStr = String(tableId);
    const current = form.values.table_ids;
    if (current.includes(idStr)) {
      form.setFieldValue('table_ids', current.filter((id) => id !== idStr));
    } else {
      form.setFieldValue('table_ids', [...current, idStr]);
    }
  };

  useEffect(() => {
    if (!opened) return;
    form.reset();
    if (tableIds && tableIds.length > 0) {
      form.setFieldValue('table_ids', tableIds.map(String));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, tableIds]);

  const handleSubmit = (values: typeof form.values) => {
    walkinMutation.mutate(
      {
        guest_name: values.guest_name.trim(),
        guest_count: values.guest_count,
        table_ids: values.table_ids.map(Number),
        date: dayjs().format('YYYY-MM-DD'),
        start_time: values.start_time,
        duration_minutes: parseInt(values.duration_minutes, 10),
      },
      {
        onSuccess: () => {
          const tables = values.table_ids.length > 0 ? `, sto ${values.table_ids.join(', ')}` : '';
          notifications.show({
            title: 'Walk-in kreiran',
            message: `${values.guest_name}, ${values.guest_count} gostiju${tables}`,
            color: 'green',
            icon: <IconCheck size={18} />,
            autoClose: 4000,
          });
          onClose();
        },
        onError: (error: Error) => {
          notifications.show({
            title: 'Walk-in nije kreiran',
            message: error.message || 'Došlo je do greške. Proverite da stolovi nisu zauzeti i pokušajte ponovo.',
            color: 'red',
            icon: <IconX size={18} />,
            autoClose: 6000,
          });
        },
      }
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Walk-in gost"
      size="md"
      fullScreen={isMobile}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <Group grow>
            <TextInput
              placeholder="Ime gosta"
              required
              leftSection={<IconUser size={16} />}
              {...form.getInputProps('guest_name')}
            />
            <NumberInput
              placeholder="Broj gostiju"
              min={1}
              required
              leftSection={<IconUsers size={16} />}
              {...form.getInputProps('guest_count')}
            />
          </Group>

          {/* Time + Duration */}
          <Group grow>
            <Select
              placeholder="Vreme"
              data={timeSlots}
              leftSection={<IconClock size={16} />}
              required
              {...form.getInputProps('start_time')}
            />
            <Select
              placeholder="Trajanje"
              data={DURATION_OPTIONS}
              leftSection={<IconHourglass size={16} />}
              {...form.getInputProps('duration_minutes')}
            />
          </Group>

          {/* Zone-grouped table cards */}
          <Text size="sm" fw={600}>Izbor stolova</Text>
          <Stack gap="xs">
            {activeZones.map((zone) => {
              const zoneTables = tablesByZone[zone.id];
              if (!zoneTables || zoneTables.length === 0) return null;
              return (
                <div key={zone.id}>
                  <Text size="xs" fw={600} c="dimmed" mb={4}>
                    {zone.name}
                  </Text>
                  <SimpleGrid cols={{ base: 5, sm: 7 }} spacing={6}>
                    {zoneTables.map((table) => {
                      const isSelected = form.values.table_ids.includes(String(table.id));
                      return (
                        <UnstyledButton
                          key={table.id}
                          onClick={() => toggleTable(table.id)}
                        >
                          <Paper
                            p={4}
                            withBorder
                            ta="center"
                            style={{
                              borderColor: isSelected
                                ? 'var(--mantine-color-teal-5)'
                                : 'var(--mantine-color-green-3)',
                              borderWidth: isSelected ? 2 : 1,
                              backgroundColor: isSelected
                                ? 'var(--mantine-color-teal-0)'
                                : undefined,
                            }}
                          >
                            <Text size="sm" fw={700} lh={1}>
                              {table.table_number}
                            </Text>
                            <Text size="xs" c="dimmed" lh={1.2} style={{ fontSize: 10 }}>
                              {table.capacity}m
                            </Text>
                          </Paper>
                        </UnstyledButton>
                      );
                    })}
                  </SimpleGrid>
                </div>
              );
            })}
          </Stack>

          <Group grow={isMobile} justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              Otkazi
            </Button>
            <Button type="submit" loading={walkinMutation.isPending} disabled={walkinMutation.isPending}>
              Dodaj walk-in
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
