import { useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Button,
  Group,
  Stack,
  SegmentedControl,
  Text,
  Paper,
  SimpleGrid,
  UnstyledButton,
  Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useQuery } from '@tanstack/react-query';
import {
  IconUser,
  IconPhone,
  IconUsers,
  IconCalendar,
  IconClock,
  IconHourglass,
  IconAlertTriangle,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { Reservation, ReservationType, Table } from '../../api/types';
import {
  useCreateReservation,
  useUpdateReservation,
  useAvailability,
} from '../../hooks/useReservations';
import { zonesApi, tablesApi, workingHoursApi } from '../../api/endpoints';

interface ReservationFormProps {
  opened: boolean;
  onClose: () => void;
  tableIds?: number[];
  date?: string;
  startTime?: string;
  reservation?: Reservation;
}

const DURATION_OPTIONS = [
  { value: '60', label: '1h' },
  { value: '90', label: '1.5h' },
  { value: '120', label: '2h' },
  { value: '150', label: '2.5h' },
  { value: '180', label: '3h' },
  { value: '240', label: '4h' },
];

function generateTimeSlots(openTime?: string, closeTime?: string): { value: string; label: string }[] {
  const start = openTime ? dayjs(`2000-01-01 ${openTime}`) : dayjs('2000-01-01 08:00');
  let end = closeTime ? dayjs(`2000-01-01 ${closeTime}`) : dayjs('2000-01-01 23:00');

  if (end.isBefore(start)) {
    end = end.add(1, 'day');
  }

  const slots: { value: string; label: string }[] = [];
  let current = start;
  while (current.isBefore(end)) {
    const timeStr = current.format('HH:mm');
    slots.push({ value: timeStr, label: timeStr });
    current = current.add(30, 'minute');
  }
  return slots;
}

/** Returns the next 30-min rounded time slot from now */
function getSmartDefaultTime(): string {
  const now = dayjs();
  const min = now.minute();
  const roundedMin = min < 30 ? 30 : 0;
  const roundedHour = min < 30 ? now.hour() : now.hour() + 1;
  return `${String(roundedHour).padStart(2, '0')}:${String(roundedMin).padStart(2, '0')}`;
}

/** Check if current time is past closing for a given day's working hours */
function isAfterClosing(workingHoursEntry?: { close_time: string | null }): boolean {
  if (!workingHoursEntry?.close_time) return false;
  const now = dayjs();
  const closeTime = workingHoursEntry.close_time.substring(0, 5);
  return now.format('HH:mm') >= closeTime;
}

export function ReservationForm({
  opened,
  onClose,
  tableIds,
  date,
  startTime,
  reservation,
}: ReservationFormProps) {
  const isEdit = !!reservation;
  const isMobile = useMediaQuery('(max-width: 48em)');

  const createMutation = useCreateReservation();
  const updateMutation = useUpdateReservation();

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: () => zonesApi.list(),
  });

  const { data: workingHours } = useQuery({
    queryKey: ['working-hours'],
    queryFn: () => workingHoursApi.get(),
  });

  const form = useForm({
    initialValues: {
      guest_name: '',
      guest_phone: '',
      guest_count: 2,
      date: new Date(),
      start_time: '',
      duration_minutes: '120',
      table_ids: [] as string[],
      reservation_type: 'standard' as ReservationType,
      notes: '',
      celebration_details: '',
    },
    validate: {
      guest_name: (v) =>
        v.trim().length === 0
          ? 'Ime gosta je obavezno'
          : v.trim().length < 2
            ? 'Ime mora imati najmanje 2 karaktera'
            : null,
      guest_phone: (v) =>
        v && v.trim().length > 0 && !/^[+\d\s()-]{6,20}$/.test(v.trim())
          ? 'Unesite ispravan broj telefona'
          : null,
      guest_count: (v) =>
        v < 1
          ? 'Broj gostiju mora biti najmanje 1'
          : v > 50
            ? 'Maksimalan broj gostiju je 50'
            : null,
      start_time: (v) => (v.length === 0 ? 'Izaberite vreme dolaska' : null),
      table_ids: (v) => (v.length === 0 ? 'Izaberite najmanje jedan sto' : null),
    },
  });

  const selectedDayOfWeek = form.values.date ? dayjs(form.values.date).day() : null;
  const todayHours = useMemo(() => {
    if (!workingHours || selectedDayOfWeek === null) return undefined;
    return workingHours.find((wh) => wh.day_of_week === selectedDayOfWeek);
  }, [workingHours, selectedDayOfWeek]);

  const timeSlots = useMemo(
    () => generateTimeSlots(todayHours?.open_time, todayHours?.close_time),
    [todayHours]
  );

  // Fetch all tables across zones
  const allZoneIds = zones?.map((z) => z.id) || [];
  const tableQueries = useQuery({
    queryKey: ['all-tables', allZoneIds],
    queryFn: async () => {
      if (!zones || zones.length === 0) return [];
      const results = await Promise.all(zones.map((z) => tablesApi.listByZone(z.id)));
      return results.flat();
    },
    enabled: !!zones && zones.length > 0,
  });

  // Check availability
  const formDate = form.values.date ? dayjs(form.values.date).format('YYYY-MM-DD') : '';
  const availabilityParams = useMemo(() => {
    if (!formDate || !form.values.start_time || !form.values.duration_minutes || !form.values.guest_count) {
      return null;
    }
    return {
      date: formDate,
      time: form.values.start_time,
      duration: parseInt(form.values.duration_minutes, 10),
      guests: 0,
    };
  }, [formDate, form.values.start_time, form.values.duration_minutes]);

  const { data: availability } = useAvailability(availabilityParams);

  // Group tables by zone for card display
  const activeZones = useMemo(
    () => (zones ?? []).filter((z) => z.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [zones]
  );

  const allTables = tableQueries.data ?? [];
  const availableIds = useMemo(
    () => new Set(availability?.available_tables?.map((t: Table) => t.id) || []),
    [availability]
  );

  const tablesByZone = useMemo(() => {
    const activeTables = allTables.filter((t) => t.is_active);
    const grouped: Record<number, typeof activeTables> = {};
    for (const t of activeTables) {
      if (!grouped[t.zone_id]) grouped[t.zone_id] = [];
      grouped[t.zone_id].push(t);
    }
    // Sort tables by table_number within each zone
    for (const zoneId of Object.keys(grouped)) {
      grouped[Number(zoneId)].sort((a, b) => String(a.table_number).localeCompare(String(b.table_number), undefined, { numeric: true }));
    }
    return grouped;
  }, [allTables]);

  const canShowTables = !!availabilityParams;

  const toggleTable = (tableId: number) => {
    const idStr = String(tableId);
    const current = form.values.table_ids;
    if (current.includes(idStr)) {
      form.setFieldValue('table_ids', current.filter((id) => id !== idStr));
    } else {
      form.setFieldValue('table_ids', [...current, idStr]);
    }
  };

  // Capacity warning
  const selectedCapacity = useMemo(() => {
    return form.values.table_ids.reduce((sum, idStr) => {
      const table = allTables.find((t) => t.id === Number(idStr));
      return sum + (table?.capacity ?? 0);
    }, 0);
  }, [form.values.table_ids, allTables]);

  const capacityExceeded = form.values.table_ids.length > 0 && form.values.guest_count > selectedCapacity;

  // Compute smart defaults for date/time based on working hours
  const getSmartDefaults = useCallback(() => {
    const now = dayjs();
    const dow = now.day();
    const todayWH = workingHours?.find((wh) => wh.day_of_week === dow);

    // If past closing time today, suggest tomorrow
    if (isAfterClosing(todayWH)) {
      const tomorrow = now.add(1, 'day');
      const tomorrowDow = tomorrow.day();
      const tomorrowWH = workingHours?.find((wh) => wh.day_of_week === tomorrowDow);
      const openTime = tomorrowWH?.open_time?.substring(0, 5) ?? '12:00';
      return { date: tomorrow.toDate(), time: openTime };
    }

    // If before opening, suggest opening time
    const openTime = todayWH?.open_time?.substring(0, 5);
    if (openTime && now.format('HH:mm') < openTime) {
      return { date: now.toDate(), time: openTime };
    }

    // During working hours: next 30-min slot
    return { date: now.toDate(), time: getSmartDefaultTime() };
  }, [workingHours]);

  // Populate form when editing or when props change
  useEffect(() => {
    if (!opened) return;

    if (reservation) {
      form.setValues({
        guest_name: reservation.guest_name,
        guest_phone: reservation.guest_phone || '',
        guest_count: reservation.guest_count,
        date: new Date(reservation.date),
        start_time: reservation.start_time.slice(0, 5),
        duration_minutes: String(reservation.duration_minutes),
        table_ids: reservation.tables.map((t) => String(t.table_id)),
        reservation_type: reservation.reservation_type,
        notes: reservation.notes || '',
        celebration_details: reservation.celebration_details || '',
      });
    } else {
      form.reset();
      const defaults = getSmartDefaults();
      if (date) {
        form.setFieldValue('date', new Date(date));
      } else {
        form.setFieldValue('date', defaults.date);
      }
      if (startTime) {
        form.setFieldValue('start_time', startTime);
      } else {
        form.setFieldValue('start_time', defaults.time);
      }
      if (tableIds && tableIds.length > 0) {
        form.setFieldValue('table_ids', tableIds.map(String));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, reservation, date, tableIds, startTime]);

  // U1: Midnight crossing check + U2: Long reservation warning
  const durationWarning = useMemo(() => {
    const dur = parseInt(form.values.duration_minutes, 10);
    if (!form.values.start_time || isNaN(dur)) return null;
    const [h, m] = form.values.start_time.split(':').map(Number);
    const totalMinutes = h * 60 + m + dur;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    if (endTime <= form.values.start_time && endTime !== '00:00') {
      return 'Rezervacija prelazi ponoć i neće biti prihvaćena. Skratite trajanje.';
    }
    if (dur >= 360) {
      return `Trajanje od ${dur / 60}h je neuobičajeno dugo. Da li ste sigurni?`;
    }
    return null;
  }, [form.values.start_time, form.values.duration_minutes]);

  const handleSubmit = (values: typeof form.values) => {
    const durationMin = parseInt(values.duration_minutes, 10);
    const formattedDate = dayjs(values.date).format('YYYY-MM-DD');

    // U1: Block midnight crossing on client
    if (values.start_time) {
      const [h, m] = values.start_time.split(':').map(Number);
      const totalMinutes = h * 60 + m + durationMin;
      const endH = Math.floor(totalMinutes / 60) % 24;
      const endM = totalMinutes % 60;
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      if (endTime <= values.start_time && endTime !== '00:00') {
        notifications.show({
          title: 'Greška',
          message: 'Rezervacija ne može prelaziti ponoć. Skratite trajanje.',
          color: 'red',
          icon: <IconX size={18} />,
        });
        return;
      }
    }

    const payload = {
      reservation_type: values.reservation_type,
      guest_name: values.guest_name.trim(),
      guest_phone: values.guest_phone.trim() || undefined,
      guest_count: values.guest_count,
      date: formattedDate,
      start_time: values.start_time,
      duration_minutes: durationMin,
      notes: values.notes.trim() || undefined,
      celebration_details:
        values.reservation_type === 'celebration'
          ? values.celebration_details.trim() || undefined
          : undefined,
      table_ids: values.table_ids.map(Number),
    };

    const callbacks = {
      onSuccess: () => {
        notifications.show({
          title: isEdit ? 'Rezervacija azurirana' : 'Rezervacija kreirana',
          message: `${values.guest_name}, ${dayjs(values.date).format('DD.MM.')} u ${values.start_time}, ${values.guest_count} gostiju`,
          color: 'green',
          icon: <IconCheck size={18} />,
          autoClose: 4000,
        });
        onClose();
      },
      onError: (error: Error) => {
        notifications.show({
          title: `Greška pri ${isEdit ? 'ažuriranju' : 'kreiranju'}`,
          message: error.message || 'Došlo je do neočekivane greške. Pokušajte ponovo.',
          color: 'red',
          icon: <IconX size={18} />,
          autoClose: 6000,
        });
      },
    };

    if (isEdit) {
      updateMutation.mutate({ id: reservation!.id, data: payload }, callbacks);
    } else {
      createMutation.mutate(payload, callbacks);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? 'Izmeni rezervaciju' : 'Nova rezervacija'}
      size="lg"
      fullScreen={isMobile}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          {/* Gost */}
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">Gost</Text>
          <Group grow>
            <TextInput
              placeholder="Ime gosta"
              required
              leftSection={<IconUser size={16} />}
              {...form.getInputProps('guest_name')}
            />
            <TextInput
              placeholder="Telefon"
              leftSection={<IconPhone size={16} />}
              {...form.getInputProps('guest_phone')}
            />
          </Group>

          {/* Termin */}
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" mt="xs">Termin</Text>
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <NumberInput
              placeholder="Gosti"
              min={1}
              required
              leftSection={<IconUsers size={16} />}
              {...form.getInputProps('guest_count')}
            />
            <DatePickerInput
              placeholder="Datum"
              required
              valueFormat="DD.MM.YYYY"
              leftSection={<IconCalendar size={16} />}
              {...form.getInputProps('date')}
            />
            <Select
              placeholder="Vreme"
              data={timeSlots}
              required
              searchable
              leftSection={<IconClock size={16} />}
              {...form.getInputProps('start_time')}
            />
            <Select
              placeholder="Trajanje"
              data={DURATION_OPTIONS}
              leftSection={<IconHourglass size={16} />}
              {...form.getInputProps('duration_minutes')}
            />
          </SimpleGrid>

          {/* Row 3: Reservation type */}
          <SegmentedControl
            size="xs"
            data={[
              { value: 'standard', label: 'Standard' },
              { value: 'celebration', label: 'Proslava' },
            ]}
            {...form.getInputProps('reservation_type')}
          />

          {/* Row 4: Zone-grouped table selection */}
          <Text size="sm" fw={600}>
            Izbor stolova <Text span c="red" size="sm">*</Text>
          </Text>
          {form.errors.table_ids && (
            <Text size="xs" c="red">{form.errors.table_ids}</Text>
          )}
          {canShowTables ? (
            <Stack gap="xs">
              {activeZones.map((zone) => {
                const zoneTables = tablesByZone[zone.id];
                if (!zoneTables || zoneTables.length === 0) return null;
                const freeCount = zoneTables.filter((t) => availableIds.has(t.id)).length;
                return (
                  <div key={zone.id}>
                    <Text size="xs" fw={600} c="dimmed" mb={4}>
                      {zone.name} ({freeCount} slobodn{freeCount === 1 ? 'o' : 'ih'})
                    </Text>
                    <SimpleGrid cols={{ base: 5, sm: 7 }} spacing={6}>
                      {zoneTables.map((table) => {
                        const isAvailable = availableIds.size === 0 || availableIds.has(table.id);
                        const isSelected = form.values.table_ids.includes(String(table.id));
                        const isSmall = isAvailable && table.capacity < form.values.guest_count;
                        return (
                          <UnstyledButton
                            key={table.id}
                            onClick={() => isAvailable && toggleTable(table.id)}
                            style={{ cursor: isAvailable ? 'pointer' : 'default' }}
                          >
                            <Paper
                              p={4}
                              withBorder
                              ta="center"
                              style={{
                                opacity: isAvailable ? 1 : 0.4,
                                borderColor: isSelected
                                  ? 'var(--mantine-color-teal-5)'
                                  : isSmall
                                    ? 'var(--mantine-color-orange-4)'
                                    : isAvailable
                                      ? 'var(--mantine-color-green-3)'
                                      : undefined,
                                borderWidth: isSelected ? 2 : 1,
                                backgroundColor: isSelected
                                  ? 'var(--mantine-color-teal-0)'
                                  : isSmall
                                    ? 'var(--mantine-color-orange-0)'
                                    : undefined,
                              }}
                            >
                              <Text size="sm" fw={700} lh={1}>
                                {table.table_number}
                              </Text>
                              <Group gap={2} justify="center" style={{ fontSize: 10 }}>
                                {!isAvailable ? (
                                  <Text size="xs" c="dimmed" lh={1.2} style={{ fontSize: 10 }}>zauzet</Text>
                                ) : (
                                  <>
                                    <Text size="xs" c={isSmall ? 'orange.6' : 'dimmed'} lh={1.2} style={{ fontSize: 10 }}>
                                      {table.capacity}
                                    </Text>
                                    <IconUsers size={10} color={isSmall ? 'var(--mantine-color-orange-6)' : 'var(--mantine-color-gray-5)'} />
                                  </>
                                )}
                              </Group>
                            </Paper>
                          </UnstyledButton>
                        );
                      })}
                    </SimpleGrid>
                  </div>
                );
              })}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed" fs="italic">
              Unesite vreme i broj gostiju za prikaz dostupnosti
            </Text>
          )}

          {/* Row 5: Notes */}
          <Textarea
            placeholder="Napomene..."
            autosize
            minRows={1}
            maxRows={3}
            {...form.getInputProps('notes')}
          />

          {form.values.reservation_type === 'celebration' && (
            <Textarea
              placeholder="Detalji proslave, posebni zahtevi..."
              autosize
              minRows={1}
              maxRows={3}
              {...form.getInputProps('celebration_details')}
            />
          )}

          {/* Capacity warning */}
          {capacityExceeded && (
            <Alert
              variant="light"
              color="orange"
              icon={<IconAlertTriangle size={16} />}
            >
              Broj gostiju ({form.values.guest_count}) prelazi kapacitet izabranih stolova ({selectedCapacity} mesta)
            </Alert>
          )}

          {/* U1/U2: Midnight crossing / long duration warning */}
          {durationWarning && (
            <Alert
              variant="light"
              color={durationWarning.includes('ponoć') ? 'red' : 'orange'}
              icon={<IconAlertTriangle size={16} />}
            >
              {durationWarning}
            </Alert>
          )}

          {/* Row 6: Actions */}
          <Group grow={isMobile} justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              Otkazi
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {isEdit ? 'Sacuvaj izmene' : 'Kreiraj rezervaciju'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
