import { useState } from 'react';
import {
  Table,
  Button,
  Group,
  Modal,
  TextInput,
  PasswordInput,
  Select,
  Badge,
  ActionIcon,
  Stack,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconUserOff, IconPlus } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/endpoints';
import type { User } from '../../api/types';
import { useAuthStore } from '../../stores/authStore';

const roleLabels: Record<string, string> = {
  owner: 'Vlasnik',
  manager: 'Menadžer',
  hostess: 'Hostesa',
  waiter: 'Konobar',
};

interface UserFormValues {
  username: string;
  display_name: string;
  password: string;
  role: string;
}

export function UserManager() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const form = useForm<UserFormValues>({
    initialValues: {
      username: '',
      display_name: '',
      password: '',
      role: 'waiter',
    },
    validate: {
      username: (value) => (value.trim() ? null : 'Korisničko ime je obavezno'),
      display_name: (value) => (value.trim() ? null : 'Ime za prikaz je obavezno'),
      password: (value) => {
        // Password is required only for new users
        if (!editingUser && !value.trim()) {
          return 'Lozinka je obavezna';
        }
        return null;
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { username: string; password: string; display_name: string; role: string }) =>
      usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notifications.show({
        title: 'Uspeh',
        message: 'Korisnik je uspešno kreiran',
        color: 'green',
      });
      closeModal();
    },
    onError: () => {
      notifications.show({
        title: 'Greška',
        message: 'Nije moguće kreirati korisnika',
        color: 'red',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<{ username: string; password: string; display_name: string; role: string; is_active: boolean }> }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notifications.show({
        title: 'Uspeh',
        message: 'Korisnik je uspešno ažuriran',
        color: 'green',
      });
      closeModal();
    },
    onError: () => {
      notifications.show({
        title: 'Greška',
        message: 'Nije moguće ažurirati korisnika',
        color: 'red',
      });
    },
  });

  const openCreateModal = () => {
    setEditingUser(null);
    form.reset();
    setModalOpened(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    form.setValues({
      username: user.username,
      display_name: user.display_name,
      password: '',
      role: user.role,
    });
    setModalOpened(true);
  };

  const closeModal = () => {
    setModalOpened(false);
    setEditingUser(null);
    form.reset();
  };

  const handleSubmit = (values: UserFormValues) => {
    if (editingUser) {
      const data: Partial<{ username: string; password: string; display_name: string; role: string }> = {
        username: values.username,
        display_name: values.display_name,
        role: values.role,
      };
      if (values.password.trim()) {
        data.password = values.password;
      }
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      createMutation.mutate({
        username: values.username,
        password: values.password,
        display_name: values.display_name,
        role: values.role,
      });
    }
  };

  const confirmDeactivate = (user: User) => {
    if (currentUser && currentUser.id === user.id) {
      notifications.show({
        title: 'Upozorenje',
        message: 'Ne možete deaktivirati sopstveni nalog',
        color: 'orange',
      });
      return;
    }

    modals.openConfirmModal({
      title: 'Deaktivacija korisnika',
      children: (
        <Text size="sm">
          Da li ste sigurni da želite da deaktivirate korisnika &quot;{user.display_name}&quot;?
        </Text>
      ),
      labels: { confirm: 'Deaktiviraj', cancel: 'Otkaži' },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        updateMutation.mutate({ id: user.id, data: { is_active: false } }),
    });
  };

  const rows = users.map((user) => (
    <Table.Tr key={user.id}>
      <Table.Td>{user.username}</Table.Td>
      <Table.Td>{user.display_name}</Table.Td>
      <Table.Td>
        <Badge
          variant="light"
          color={user.role === 'owner' ? 'teal' : user.role === 'manager' ? 'blue' : 'gray'}
          size="sm"
        >
          {roleLabels[user.role] || user.role}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Badge color={user.is_active ? 'green' : 'gray'}>
          {user.is_active ? 'Da' : 'Ne'}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            color="teal"
            onClick={() => openEditModal(user)}
            title="Izmeni"
          >
            <IconEdit size={16} />
          </ActionIcon>
          {user.is_active && (
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => confirmDeactivate(user)}
              title="Deaktiviraj"
              disabled={currentUser?.id === user.id}
            >
              <IconUserOff size={16} />
            </ActionIcon>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600} size="lg">Korisnici</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
          Dodaj korisnika
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Korisničko ime</Table.Th>
            <Table.Th>Ime</Table.Th>
            <Table.Th>Uloga</Table.Th>
            <Table.Th>Aktivan</Table.Th>
            <Table.Th>Akcije</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text ta="center" c="dimmed">Učitavanje...</Text>
              </Table.Td>
            </Table.Tr>
          ) : users.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text ta="center" c="dimmed">Nema korisnika</Text>
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
        title={editingUser ? 'Izmeni korisnika' : 'Dodaj korisnika'}
        size="md"
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Korisničko ime"
              placeholder="Korisničko ime"
              required
              {...form.getInputProps('username')}
            />
            <TextInput
              label="Ime za prikaz"
              placeholder="Ime i prezime"
              required
              {...form.getInputProps('display_name')}
            />
            <PasswordInput
              label="Lozinka"
              placeholder={editingUser ? 'Ostavite prazno ako ne menjate' : 'Lozinka'}
              required={!editingUser}
              {...form.getInputProps('password')}
            />
            <Select
              label="Uloga"
              data={[
                { value: 'owner', label: 'Vlasnik' },
                { value: 'manager', label: 'Menadžer' },
                { value: 'waiter', label: 'Konobar' },
              ]}
              {...form.getInputProps('role')}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={closeModal}>
                Otkaži
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editingUser ? 'Sačuvaj' : 'Kreiraj'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
