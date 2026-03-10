import { useMemo } from 'react';
import {
  Paper,
  Title,
  Table,
  Switch,
  Text,
  Group,
  Badge,
  Loader,
  Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconShieldLock } from '@tabler/icons-react';
import { usePermissions, useUpdatePermissions } from '../../hooks/usePermissions';
import type { Permission, RolePermission } from '../../api/types';

const ROLES = ['owner', 'manager', 'waiter'] as const;

const ROLE_LABELS: Record<string, string> = {
  owner: 'Vlasnik',
  manager: 'Menadžer',
  waiter: 'Konobar',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'teal',
  manager: 'blue',
  waiter: 'gray',
};

const PERMISSION_LABELS: Record<Permission, string> = {
  create_reservation: 'Kreiranje rezervacija',
  create_walkin: 'Kreiranje walk-in',
  delete_reservation: 'Brisanje rezervacija',
  transfer_table: 'Transfer stola',
  status_no_show: 'Označavanje No show',
  status_otkazana: 'Otkazivanje rezervacija',
  status_odlozena: 'Odlaganje rezervacija',
};

const PERMISSION_ORDER: Permission[] = [
  'create_reservation',
  'create_walkin',
  'transfer_table',
  'delete_reservation',
  'status_otkazana',
  'status_no_show',
  'status_odlozena',
];

export function PermissionsManager() {
  const { data: permissions, isLoading } = usePermissions();
  const updateMutation = useUpdatePermissions();

  // Build a lookup map: role -> permission -> allowed
  const permMap = useMemo(() => {
    const map: Record<string, Record<string, boolean>> = {};
    for (const role of ROLES) {
      map[role] = {};
    }
    for (const p of permissions || []) {
      if (!map[p.role]) map[p.role] = {};
      map[p.role][p.permission] = p.allowed;
    }
    return map;
  }, [permissions]);

  const handleToggle = (role: string, permission: Permission, newValue: boolean) => {
    // Don't allow changing owner permissions
    if (role === 'owner') return;

    const updated: RolePermission[] = [
      { role, permission, allowed: newValue },
    ];

    updateMutation.mutate(updated, {
      onSuccess: () => {
        notifications.show({
          title: 'Dozvola ažurirana',
          message: `${ROLE_LABELS[role]}: ${PERMISSION_LABELS[permission]} — ${newValue ? 'dozvoljeno' : 'zabranjeno'}`,
          color: 'green',
          icon: <IconCheck size={18} />,
          autoClose: 3000,
        });
      },
      onError: (error: Error) => {
        notifications.show({
          title: 'Greška',
          message: error.message || 'Ažuriranje dozvola nije uspelo',
          color: 'red',
          icon: <IconX size={18} />,
        });
      },
    });
  };

  if (isLoading) {
    return (
      <Paper withBorder p="lg">
        <Group justify="center" py="xl">
          <Loader size="sm" />
          <Text c="dimmed">Učitavanje dozvola...</Text>
        </Group>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <Group mb="md">
        <IconShieldLock size={22} />
        <Title order={4}>Dozvole po rolama</Title>
      </Group>

      <Alert variant="light" color="gray" mb="md">
        Vlasnik uvek ima sve dozvole. Menjajte pristup za menadžera i konobara.
      </Alert>

      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Akcija</Table.Th>
            {ROLES.map((role) => (
              <Table.Th key={role} ta="center">
                <Badge variant="light" color={ROLE_COLORS[role]} size="sm">
                  {ROLE_LABELS[role]}
                </Badge>
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {PERMISSION_ORDER.map((perm) => (
            <Table.Tr key={perm}>
              <Table.Td>
                <Text size="sm">{PERMISSION_LABELS[perm]}</Text>
              </Table.Td>
              {ROLES.map((role) => {
                const allowed = permMap[role]?.[perm] ?? false;
                const isOwner = role === 'owner';
                return (
                  <Table.Td key={role} ta="center">
                    <Switch
                      checked={allowed}
                      onChange={(e) =>
                        handleToggle(role, perm, e.currentTarget.checked)
                      }
                      disabled={isOwner}
                      size="md"
                      styles={{
                        root: { display: 'inline-flex', justifyContent: 'center' },
                      }}
                    />
                  </Table.Td>
                );
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
