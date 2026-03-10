import { useState, useMemo } from 'react';
import {
  Paper,
  Button,
  Group,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Badge,
  ActionIcon,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconEdit,
  IconTrash,
  IconPlus,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tablesApi } from '../../api/endpoints';
import type { Table as TableType, Zone } from '../../api/types';

// ---------- Types ----------

interface TableManagerProps {
  zones: Zone[];
}

interface TableFormValues {
  table_number: string;
  capacity: number;
  zone_id: string;
}

// ---------- Table Card ----------

function TableCard({
  table,
  onEdit,
  onDelete,
}: {
  table: TableType;
  onEdit: (table: TableType) => void;
  onDelete: (table: TableType) => void;
}) {
  return (
    <Paper p="xs">
      <Group gap="xs" wrap="nowrap" justify="space-between">
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} size="sm" truncate>
            {table.table_number}
          </Text>
          <Tooltip label={`Kapacitet: ${table.capacity}`}>
            <Badge
              size="sm"
              variant="light"
              color="teal"
              leftSection={<IconUsers size={10} />}
            >
              {table.capacity}
            </Badge>
          </Tooltip>
        </Group>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="teal"
            size="sm"
            onClick={() => onEdit(table)}
          >
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={() => onDelete(table)}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
}

// ---------- Zone Section ----------

function ZoneSection({
  zone,
  tables,
  onEdit,
  onDelete,
  onAdd,
}: {
  zone: Zone;
  tables: TableType[];
  onEdit: (table: TableType) => void;
  onDelete: (table: TableType) => void;
  onAdd: (zoneId: number) => void;
}) {
  const sorted = useMemo(
    () =>
      [...tables].sort((a, b) =>
        String(a.table_number).localeCompare(String(b.table_number), undefined, {
          numeric: true,
        })
      ),
    [tables]
  );

  return (
    <Paper p="sm">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <Text fw={600} size="sm">
            {zone.name}
          </Text>
          <Badge size="xs" variant="light" color="gray">
            {tables.length} {tables.length === 1 ? 'sto' : tables.length < 5 ? 'stola' : 'stolova'}
          </Badge>
          {zone.is_seasonal && (
            <Badge size="xs" variant="light" color="cyan">
              Sezonska
            </Badge>
          )}
        </Group>
        <Button
          size="compact-xs"
          variant="light"
          leftSection={<IconPlus size={12} />}
          onClick={() => onAdd(zone.id)}
        >
          Dodaj
        </Button>
      </Group>

      {sorted.length === 0 ? (
        <Text size="xs" c="dimmed" ta="center" py="md" fs="italic">
          Nema stolova. Kliknite &quot;Dodaj&quot; da dodate sto.
        </Text>
      ) : (
        <Stack gap={6}>
          {sorted.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </Stack>
      )}
    </Paper>
  );
}

// ---------- Main Component ----------

export function TableManager({ zones }: TableManagerProps) {
  const queryClient = useQueryClient();
  const [modalOpened, setModalOpened] = useState(false);
  const [editingTable, setEditingTable] = useState<TableType | null>(null);

  // Fetch tables for all zones
  const { data: allTablesMap = {} } = useQuery({
    queryKey: ['all-admin-tables', zones.map((z) => z.id)],
    queryFn: async () => {
      const results: Record<number, TableType[]> = {};
      await Promise.all(
        zones.map(async (zone) => {
          const tables = await tablesApi.listByZone(zone.id);
          results[zone.id] = tables;
        })
      );
      return results;
    },
    enabled: zones.length > 0,
  });

  const zoneOptions = zones.map((z) => ({
    value: String(z.id),
    label: z.name,
  }));

  const form = useForm<TableFormValues>({
    initialValues: {
      table_number: '',
      capacity: 2,
      zone_id: '',
    },
    validate: {
      table_number: (v) => (v.trim() ? null : 'Broj stola je obavezan'),
      capacity: (v) => (v >= 1 ? null : 'Kapacitet mora biti najmanje 1'),
      zone_id: (v) => (v ? null : 'Izaberite zonu'),
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { zoneId: number; table: Partial<TableType> }) =>
      tablesApi.create(data.zoneId, data.table),
    onSuccess: () => {
      invalidateAll();
      notifications.show({ title: 'Uspeh', message: 'Sto je uspesno kreiran', color: 'green' });
      closeModal();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Greska',
        message: error.message || 'Nije moguce kreirati sto',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TableType & { zone_id: number }> }) =>
      tablesApi.update(id, data),
    onSuccess: () => {
      invalidateAll();
      notifications.show({ title: 'Uspeh', message: 'Sto je uspesno azuriran', color: 'green' });
      closeModal();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Greska',
        message: error.message || 'Nije moguce azurirati sto',
        color: 'red',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tablesApi.delete(id),
    onSuccess: () => {
      invalidateAll();
      notifications.show({ title: 'Uspeh', message: 'Sto je obrisan', color: 'green' });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Greska',
        message: error.message || 'Nije moguce obrisati sto',
        color: 'red',
      });
    },
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['all-admin-tables'] });
    for (const zone of zones) {
      queryClient.invalidateQueries({ queryKey: ['tables', zone.id] });
    }
    queryClient.invalidateQueries({ queryKey: ['tables'] });
  }

  const openCreateModal = (zoneId: number) => {
    setEditingTable(null);
    form.reset();
    form.setFieldValue('zone_id', String(zoneId));
    setModalOpened(true);
  };

  const openEditModal = (table: TableType) => {
    setEditingTable(table);
    form.setValues({
      table_number: table.table_number,
      capacity: table.capacity,
      zone_id: String(table.zone_id),
    });
    setModalOpened(true);
  };

  const closeModal = () => {
    setModalOpened(false);
    setEditingTable(null);
    form.reset();
  };

  const handleSubmit = (values: TableFormValues) => {
    const zoneId = Number(values.zone_id);
    const data: Partial<TableType> = {
      table_number: values.table_number,
      capacity: values.capacity,
    };

    if (editingTable) {
      const updateData: Partial<TableType & { zone_id: number }> = { ...data };
      if (zoneId !== editingTable.zone_id) {
        (updateData as any).zone_id = zoneId;
      }
      updateMutation.mutate({ id: editingTable.id, data: updateData });
    } else {
      createMutation.mutate({ zoneId, table: data });
    }
  };

  const confirmDelete = (table: TableType) => {
    modals.openConfirmModal({
      title: 'Brisanje stola',
      children: (
        <Stack gap="xs">
          <Text size="sm">
            Da li ste sigurni da zelite da obrisete sto &quot;{table.table_number}&quot;?
          </Text>
          <Text size="xs" c="dimmed">
            Prosle rezervacije ostaju sacuvane. Ako sto ima aktivne buduce rezervacije, brisanje nece biti moguce.
          </Text>
        </Stack>
      ),
      labels: { confirm: 'Obrisi', cancel: 'Otkazi' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(table.id),
    });
  };

  const totalTables = Object.values(allTablesMap).flat().length;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <Text fw={600} size="lg">Stolovi po zonama</Text>
          <Badge size="sm" variant="light" color="gray">
            {totalTables} ukupno
          </Badge>
        </Group>
      </Group>

      <Stack gap="md">
        {zones.map((zone) => (
          <ZoneSection
            key={zone.id}
            zone={zone}
            tables={allTablesMap[zone.id] || []}
            onEdit={openEditModal}
            onDelete={confirmDelete}
            onAdd={openCreateModal}
          />
        ))}
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={editingTable ? 'Izmeni sto' : 'Dodaj sto'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <Select
              label="Zona"
              data={zoneOptions}
              required
              {...form.getInputProps('zone_id')}
            />
            <TextInput
              label="Broj stola"
              placeholder="npr. A1, 12, VIP1"
              required
              {...form.getInputProps('table_number')}
            />
            <NumberInput
              label="Kapacitet"
              placeholder="Broj mesta"
              min={1}
              required
              {...form.getInputProps('capacity')}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={closeModal}>
                Otkazi
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingTable ? 'Sacuvaj' : 'Kreiraj'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
