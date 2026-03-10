import { useEffect } from 'react';
import {
  Button,
  Group,
  Switch,
  Stack,
  Text,
  Select,
  Paper,
  SimpleGrid,
  Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workingHoursApi } from '../../api/endpoints';
import type { WorkingHours } from '../../api/types';

const dayNames = [
  'Ponedeljak',
  'Utorak',
  'Sreda',
  'Četvrtak',
  'Petak',
  'Subota',
  'Nedelja',
];

// Generate time options in 30-minute intervals
function generateTimeOptions() {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      options.push({ value, label: value });
    }
  }
  return options;
}

const timeOptions = generateTimeOptions();

interface DayFormValues {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

interface FormValues {
  days: DayFormValues[];
}

const defaultDays: DayFormValues[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  open_time: '09:00',
  close_time: '23:00',
  is_closed: false,
}));

export function WorkingHoursEditor() {
  const queryClient = useQueryClient();

  const { data: workingHours, isLoading } = useQuery({
    queryKey: ['working-hours'],
    queryFn: () => workingHoursApi.get(),
  });

  const form = useForm<FormValues>({
    initialValues: {
      days: defaultDays,
    },
  });

  useEffect(() => {
    if (workingHours && workingHours.length > 0) {
      const days = defaultDays.map((defaultDay) => {
        const existing = workingHours.find(
          (wh) => wh.day_of_week === defaultDay.day_of_week
        );
        if (existing) {
          return {
            day_of_week: existing.day_of_week,
            open_time: existing.open_time.substring(0, 5), // Ensure HH:MM format
            close_time: existing.close_time.substring(0, 5),
            is_closed: existing.is_closed,
          };
        }
        return defaultDay;
      });
      form.setValues({ days });
    }
  }, [workingHours]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<WorkingHours>[]) => workingHoursApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['working-hours'] });
      notifications.show({
        title: 'Uspeh',
        message: 'Radno vreme je uspešno sačuvano',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Greška',
        message: 'Nije moguće sačuvati radno vreme',
        color: 'red',
      });
    },
  });

  const handleSubmit = (values: FormValues) => {
    const data: Partial<WorkingHours>[] = values.days.map((day) => ({
      day_of_week: day.day_of_week,
      open_time: day.open_time,
      close_time: day.close_time,
      is_closed: day.is_closed,
    }));
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return <Text c="dimmed">Učitavanje...</Text>;
  }

  // Mini weekly overview
  const miniWeek = form.values.days;
  const totalHours = 24;

  return (
    <Stack>
      <Text fw={600} size="lg">Radno vreme</Text>

      {/* Mini weekly grid */}
      <Paper p="sm" withBorder>
        <Text size="xs" fw={600} mb="xs" c="dimmed">Nedeljni pregled</Text>
        <SimpleGrid cols={7} spacing={4}>
          {miniWeek.map((day) => {
            const dayLabel = dayNames[day.day_of_week].substring(0, 3);
            if (day.is_closed) {
              return (
                <Stack key={day.day_of_week} gap={2} align="center">
                  <Text size="xs" fw={500}>{dayLabel}</Text>
                  <Box
                    style={{
                      width: '100%',
                      height: 40,
                      borderRadius: 4,
                      backgroundColor: 'var(--mantine-color-gray-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text size="xs" c="dimmed">X</Text>
                  </Box>
                </Stack>
              );
            }

            const openH = parseInt(day.open_time.split(':')[0], 10);
            const openM = parseInt(day.open_time.split(':')[1], 10);
            const closeH = parseInt(day.close_time.split(':')[0], 10);
            const closeM = parseInt(day.close_time.split(':')[1], 10);
            const openFrac = (openH + openM / 60) / totalHours;
            const closeFrac = (closeH + closeM / 60) / totalHours;
            const topPct = `${openFrac * 100}%`;
            const heightPct = `${Math.max((closeFrac - openFrac) * 100, 5)}%`;

            return (
              <Stack key={day.day_of_week} gap={2} align="center">
                <Text size="xs" fw={500}>{dayLabel}</Text>
                <Box
                  style={{
                    width: '100%',
                    height: 40,
                    borderRadius: 4,
                    backgroundColor: 'var(--mantine-color-gray-1)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: topPct,
                      height: heightPct,
                      backgroundColor: 'var(--mantine-color-teal-5)',
                      borderRadius: 2,
                    }}
                  />
                </Box>
                <Text size="xs" c="dimmed">
                  {day.open_time}-{day.close_time}
                </Text>
              </Stack>
            );
          })}
        </SimpleGrid>
      </Paper>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          {form.values.days.map((day, index) => (
            <Paper key={day.day_of_week} p="sm" withBorder>
              <Group justify="space-between" align="center">
                <Text fw={500} w={120}>
                  {dayNames[day.day_of_week]}
                </Text>

                <Switch
                  label="Zatvoreno"
                  checked={day.is_closed}
                  onChange={(event) =>
                    form.setFieldValue(
                      `days.${index}.is_closed`,
                      event.currentTarget.checked
                    )
                  }
                />

                <Group gap="sm">
                  <Select
                    label="Otvaranje"
                    data={timeOptions}
                    w={110}
                    disabled={day.is_closed}
                    {...form.getInputProps(`days.${index}.open_time`)}
                  />
                  <Select
                    label="Zatvaranje"
                    data={timeOptions}
                    w={110}
                    disabled={day.is_closed}
                    {...form.getInputProps(`days.${index}.close_time`)}
                  />
                </Group>
              </Group>
            </Paper>
          ))}

          <Group justify="flex-end">
            <Button type="submit" loading={updateMutation.isPending}>
              Sačuvaj
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
