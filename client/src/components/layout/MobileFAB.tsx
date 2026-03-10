import { ActionIcon, Menu } from '@mantine/core';
import { IconPlus, IconCalendarPlus, IconWalk } from '@tabler/icons-react';

interface MobileFABProps {
  onNewReservation: () => void;
  onWalkin: () => void;
}

export function MobileFAB({ onNewReservation, onWalkin }: MobileFABProps) {
  return (
    <Menu position="top-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          size={56}
          radius="50%"
          variant="filled"
          color="teal"
          hiddenFrom="sm"
          style={{
            position: 'fixed',
            bottom: 76,
            right: 16,
            zIndex: 199,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
          aria-label="Nova rezervacija"
        >
          <IconPlus size={26} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconCalendarPlus size={18} />}
          onClick={onNewReservation}
          style={{ fontSize: 15, padding: '10px 14px' }}
        >
          Nova rezervacija
        </Menu.Item>
        <Menu.Item
          leftSection={<IconWalk size={18} />}
          onClick={onWalkin}
          style={{ fontSize: 15, padding: '10px 14px' }}
        >
          Walk-in
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
