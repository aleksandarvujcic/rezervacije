import { useState } from 'react';
import {
  Title,
  Stack,
  Divider,
  NavLink,
  Paper,
  SegmentedControl,
  Box,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconMap2, IconUsers, IconClock, IconShieldLock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../components/layout/AppLayout';
import { ZoneManager } from '../components/admin/ZoneManager';
import { TableManager } from '../components/admin/TableManager';
import { UserManager } from '../components/admin/UserManager';
import { WorkingHoursEditor } from '../components/admin/WorkingHoursEditor';
import { PermissionsManager } from '../components/admin/PermissionsManager';
import { zonesApi } from '../api/endpoints';

type AdminSection = 'zones' | 'users' | 'working-hours' | 'permissions';

const SECTIONS: { value: AdminSection; label: string; icon: typeof IconMap2; description: string }[] = [
  { value: 'zones', label: 'Zone i stolovi', icon: IconMap2, description: 'Upravljanje zonama i rasporedom stolova' },
  { value: 'users', label: 'Korisnici', icon: IconUsers, description: 'Upravljanje korisnickim nalozima' },
  { value: 'working-hours', label: 'Radno vreme', icon: IconClock, description: 'Podesavanje radnog vremena po danima' },
  { value: 'permissions', label: 'Dozvole', icon: IconShieldLock, description: 'Upravljanje dozvolama po rolama' },
];

const SEGMENT_DATA = SECTIONS.map((s) => ({
  value: s.value,
  label: s.label,
}));

export function AdminPage() {
  const isMobile = useMediaQuery('(max-width: 48em)');
  const [activeSection, setActiveSection] = useState<AdminSection>('zones');

  const { data: zones = [] } = useQuery({
    queryKey: ['zones'],
    queryFn: () => zonesApi.list(),
  });

  return (
    <AppLayout>
      <Stack gap="md">
        <Title order={2}>Administracija</Title>

        {/* Mobile: SegmentedControl on top */}
        <Box hiddenFrom="sm">
          <SegmentedControl
            fullWidth
            data={SEGMENT_DATA}
            value={activeSection}
            onChange={(v) => setActiveSection(v as AdminSection)}
          />
        </Box>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16 }}>
          {/* Desktop: Vertical navigation sidebar */}
          <Box visibleFrom="sm">
            <Paper withBorder p="xs" style={{ width: 240, flexShrink: 0 }}>
              <Stack gap={0}>
                {SECTIONS.map((section) => (
                  <NavLink
                    key={section.value}
                    active={activeSection === section.value}
                    label={section.label}
                    description={section.description}
                    leftSection={<section.icon size={18} />}
                    onClick={() => setActiveSection(section.value)}
                  />
                ))}
              </Stack>
            </Paper>
          </Box>

          {/* Content area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeSection === 'zones' && (
              <Stack gap="lg">
                <ZoneManager />

                <Divider />

                {zones.length > 0 ? (
                  <TableManager zones={zones} />
                ) : null}
              </Stack>
            )}

            {activeSection === 'users' && <UserManager />}

            {activeSection === 'working-hours' && <WorkingHoursEditor />}

            {activeSection === 'permissions' && <PermissionsManager />}
          </div>
        </div>
      </Stack>
    </AppLayout>
  );
}
