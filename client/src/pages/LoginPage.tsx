import { useState } from 'react';
import {
  Card,
  TextInput,
  PasswordInput,
  Button,
  Text,
  Stack,
  Center,
  Alert,
  Box,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
      navigate('/floor-plan');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Greska pri prijavi. Pokusajte ponovo.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center
      h="100vh"
      style={{
        background: 'linear-gradient(135deg, var(--mantine-color-teal-0) 0%, var(--mantine-color-gray-0) 50%, var(--mantine-color-teal-0) 100%)',
      }}
    >
      <Card shadow="lg" padding="xl" radius="lg" w={400} maw="92vw">
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <Box ta="center" mb="xs">
              <Text fw={800} size="xl" c="teal.7">
                Rezervacije
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                Prijavite se na sistem
              </Text>
            </Box>

            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="red"
                variant="light"
              >
                {error}
              </Alert>
            )}

            <TextInput
              label="Korisnicko ime"
              placeholder="Unesite korisnicko ime"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              required
            />

            <PasswordInput
              label="Lozinka"
              placeholder="Unesite lozinku"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />

            <Button type="submit" fullWidth loading={loading} size="md">
              Prijavi se
            </Button>
          </Stack>
        </form>
      </Card>
    </Center>
  );
}
