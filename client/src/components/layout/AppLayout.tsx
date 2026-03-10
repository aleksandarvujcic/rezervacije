import { ReactNode } from 'react';
import {
  AppShell,
  Group,
  NavLink,
  Text,
  Button,
  Stack,
  ActionIcon,
  Box,
  UnstyledButton,
  Badge,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconLayoutDashboard,
  IconCalendar,
  IconSettings,
  IconLogout,
} from '@tabler/icons-react';
import {
  NavLink as RouterNavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface AppLayoutProps {
  children: ReactNode;
  /** Custom content to render in the header on mobile (replaces default title) */
  mobileHeaderCenter?: ReactNode;
}

const TABS = [
  { to: '/floor-plan', label: 'Raspored', icon: IconLayoutDashboard },
  { to: '/reservations', label: 'Rezervacije', icon: IconCalendar },
  { to: '/admin', label: 'Admin', icon: IconSettings, managerOnly: true },
];

export function AppLayout({ children, mobileHeaderCenter }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isMobile = useMediaQuery('(max-width: 48em)');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isManager = user?.role === 'manager' || user?.role === 'owner';

  const visibleTabs = TABS.filter((t) => !t.managerOnly || isManager);

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{
        width: 200,
        breakpoint: 'sm',
        collapsed: { mobile: true },
      }}
      padding={8}
    >
      <AppShell.Header style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Group h="100%" px={isMobile ? 'xs' : 'md'} justify="space-between" wrap="nowrap" gap={4}>
          {isMobile && mobileHeaderCenter ? (
            /* On mobile with custom header: show compact title + custom center + logout */
            <>
              {mobileHeaderCenter}
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleLogout}
                aria-label="Odjava"
              >
                <IconLogout size={18} />
              </ActionIcon>
            </>
          ) : (
            <>
              <Text fw={800} size="md" c="teal.7">
                Rezervacije
              </Text>
              <Group gap="sm">
                {!isMobile && user && (
                  <Badge variant="light" color="teal" size="md">
                    {user.display_name}
                  </Badge>
                )}
                {isMobile ? (
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={handleLogout}
                    aria-label="Odjava"
                  >
                    <IconLogout size={18} />
                  </ActionIcon>
                ) : (
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconLogout size={16} />}
                    onClick={handleLogout}
                  >
                    Odjava
                  </Button>
                )}
              </Group>
            </>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <Stack gap={4} style={{ flex: 1 }}>
          <NavLink
            component={RouterNavLink}
            to="/floor-plan"
            label="Raspored"
            leftSection={<IconLayoutDashboard size={18} stroke={1.5} />}
            active={location.pathname === '/floor-plan'}
          />
          <NavLink
            component={RouterNavLink}
            to="/reservations"
            label="Rezervacije"
            leftSection={<IconCalendar size={18} stroke={1.5} />}
            active={location.pathname === '/reservations'}
          />
          {isManager && (
            <NavLink
              component={RouterNavLink}
              to="/admin"
              label="Admin"
              leftSection={<IconSettings size={18} stroke={1.5} />}
              active={location.pathname === '/admin'}
            />
          )}
        </Stack>
        {user && (
          <Box py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
            <Text size="sm" fw={600} truncate>{user.display_name}</Text>
            <Badge size="xs" variant="light" color="gray" mt={2}>{user.role}</Badge>
          </Box>
        )}
      </AppShell.Navbar>

      <AppShell.Main pb={isMobile ? 68 : undefined}>
        {children}
      </AppShell.Main>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <Box
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            borderTop: '1px solid var(--mantine-color-gray-3)',
            background: 'var(--mantine-color-body)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            paddingBottom: 'env(safe-area-inset-bottom)',
            zIndex: 200,
          }}
        >
          {visibleTabs.map((tab) => {
            const isActive = location.pathname === tab.to;
            return (
              <UnstyledButton
                key={tab.to}
                onClick={() => navigate(tab.to)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  flex: 1,
                  padding: '8px 0',
                }}
              >
                <tab.icon
                  size={24}
                  color={
                    isActive
                      ? 'var(--mantine-color-teal-6)'
                      : 'var(--mantine-color-gray-6)'
                  }
                />
                <Text
                  size="xs"
                  fw={isActive ? 700 : 400}
                  c={isActive ? 'teal.6' : 'gray.6'}
                  lh={1}
                >
                  {tab.label}
                </Text>
                {isActive && (
                  <Box
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      backgroundColor: 'var(--mantine-color-teal-6)',
                    }}
                  />
                )}
              </UnstyledButton>
            );
          })}
        </Box>
      )}
    </AppShell>
  );
}
