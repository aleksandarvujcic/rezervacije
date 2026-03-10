import { useState } from 'react';
import {
  Table,
  Button,
  Group,
  Modal,
  TextInput,
  Textarea,
  Switch,
  NumberInput,
  Badge,
  ActionIcon,
  Stack,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zonesApi } from '../../api/endpoints';
import type { Zone } from '../../api/types';

interface ZoneFormValues {
  name: string;
  description: string;
  is_seasonal: boolean;
  season_start: Date | null;
  season_end: Date | null;
  sort_order: number;
}

export function ZoneManager() {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: () => zonesApi.list(),
  });

  const form = useForm<ZoneFormValues>({
    initialValues: {
      name: '',
      description: '',
      is_seasonal: false,
      season_start: null,
      season_end: null,
      sort_order: 0,
    },
    validate: {
      name: (value) => (value.trim() ? null : 'Naziv je obavezan'),
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Zone>) => zonesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      notifications.show({
        title: 'Uspeh',
        message: 'Zona je uspešno kreirana',
        color: 'green',
      });
      closeModal();
    },
    onError: () => {
      notifications.show({
        title: 'Greška',
        message: 'Nije moguće kreirati zonu',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Zone> }) =>
      zonesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      notifications.show({
        title: 'Uspeh',
        message: 'Zona je uspešno ažurirana',
        color: 'green',
      });
      closeModal();
    },
    onError: () => {
      notifications.show({
        title: 'Greška',
        message: 'Nije moguće ažurirati zonu',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => zonesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      notifications.show({
        title: 'Uspeh',
        message: 'Zona je uspešno obrisana',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Greška',
        message: 'Nije moguće obrisati zonu',
        color: 'red',
      });
    },
  });

  const openCreateModal = () => {
    setEditingZone(null);
    form.reset();
    setModalOpened(true);
  };

  const openEditModal = (zone: Zone) => {
    setEditingZone(zone);
    form.setValues({
      name: zone.name,
      description: zone.description || '',
      is_seasonal: zone.is_seasonal,
      season_start: zone.season_start ? new Date(zone.season_start) : null,
      season_end: zone.season_end ? new Date(zone.season_end) : null,
      sort_order: zone.sort_order,
    });
    setModalOpened(true);
  };

  const closeModal = () => {
    setModalOpened(false);
    setEditingZone(null);
    form.reset();
  };

  const handleSubmit = (values: ZoneFormValues) => {
    const data: Partial<Zone> = {
      name: values.name,
      description: values.description || null,
      is_seasonal: values.is_seasonal,
      season_start: values.is_seasonal && values.season_start
        ? values.season_start.toISOString().split('T')[0]
        : null,
      season_end: values.is_seasonal && values.season_end
        ? values.season_end.toISOString().split('T')[0]
        : null,
      sort_order: values.sort_order,
    };

    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const confirmDelete = (zone: Zone) => {
    modals.openConfirmModal({
      title: 'Brisanje zone',
      children: (
        <Text size="sm">
          Da li ste sigurni da želite da obrišete zonu &quot;{zone.name}&quot;?
          Ova akcija se ne može poništiti.
        </Text>
      ),
      labels: { confirm: 'Obriši', cancel: 'Otkaži' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(zone.id),
    });
  };

  const rows = zones.map((zone) => (
    <Table.Tr key={zone.id}>
      <Table.Td>{zone.name}</Table.Td>
      <Table.Td>{zone.description || '-'}</Table.Td>
      <Table.Td>
        {zone.is_seasonal ? (
          <Badge color="cyan" variant="light">
            Sezonska
            {zone.season_start && zone.season_end
              ? ` (${zone.season_start.substring(5)} - ${zone.season_end.substring(5)})`
              : ''}
          </Badge>
        ) : (
          <Text size="xs" c="dimmed">Ne</Text>
        )}
      </Table.Td>
      <Table.Td>
        <Badge color={zone.is_active ? 'green' : 'gray'}>
          {zone.is_active ? 'Aktivan' : 'Neaktivan'}
        </Badge>
      </Table.Td>
      <Table.Td>{zone.sort_order}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            color="teal"
            onClick={() => openEditModal(zone)}
            title="Izmeni"
          >
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => confirmDelete(zone)}
            title="Obriši"
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">Zone</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
          Dodaj zonu
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Naziv</Table.Th>
            <Table.Th>Opis</Table.Th>
            <Table.Th>Sezonska</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Redosled</Table.Th>
            <Table.Th>Akcije</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text ta="center" c="dimmed">Učitavanje...</Text>
              </Table.Td>
            </Table.Tr>
          ) : zones.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text ta="center" c="dimmed">Nema zona</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows
          )}
        </Table.Tbody>
      </Table>

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={editingZone ? 'Izmeni zonu' : 'Dodaj zonu'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Naziv"
              placeholder="Naziv zone"
              required
              {...form.getInputProps('name')}
            />
            <Textarea
              label="Opis"
              placeholder="Opis zone"
              {...form.getInputProps('description')}
            />
            <Switch
              label="Sezonska zona"
              {...form.getInputProps('is_seasonal', { type: 'checkbox' })}
            />
            {form.values.is_seasonal && (
              <>
                <DatePickerInput
                  label="Početak sezone"
                  placeholder="Izaberite datum"
                  clearable
                  {...form.getInputProps('season_start')}
                />
                <DatePickerInput
                  label="Kraj sezone"
                  placeholder="Izaberite datum"
                  clearable
                  {...form.getInputProps('season_end')}
                />
              </>
            )}
            <NumberInput
              label="Redosled"
              placeholder="0"
              {...form.getInputProps('sort_order')}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={closeModal}>
                Otkaži
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingZone ? 'Sačuvaj' : 'Kreiraj'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
