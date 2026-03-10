import { Box, Text, Tooltip } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import type { TimelineReservation } from '../../api/endpoints';
import { STATUS_COLORS, STATUS_LABELS } from '../../config/statusConfig';
import { isEndingSoon, minutesUntil } from './timelineUtils';

interface TimelineReservationBlockProps {
  reservation: TimelineReservation;
  startCol: number;
  spanCols: number;
  slotWidth: number;
  rowHeight?: number; // reserved for future use
  isMobile?: boolean;
  searchTerm: string;
  onClick: (reservationId: number) => void;
}

export function TimelineReservationBlock({
  reservation,
  startCol,
  spanCols,
  slotWidth,
  isMobile,
  searchTerm,
  onClick,
}: TimelineReservationBlockProps) {
  const bgColor = STATUS_COLORS[reservation.status] ?? STATUS_COLORS.free;
  const endingSoon = reservation.status === 'seated' && isEndingSoon(reservation.end_time);
  const minsLeft = endingSoon ? minutesUntil(reservation.end_time) : null;

  const left = startCol * slotWidth;
  const width = spanCols * slotWidth - 1;

  // Search match logic
  const needle = searchTerm.trim().toLowerCase();
  const isSearching = needle.length > 0;
  const isMatch = isSearching && (
    reservation.guest_name.toLowerCase().includes(needle) ||
    (reservation.guest_phone && reservation.guest_phone.includes(needle))
  );
  const dimmed = isSearching && !isMatch;

  // Mobile: compact color bar with name for glanceability
  if (isMobile) {
    return (
      <Box
        onClick={(e) => {
          e.stopPropagation();
          onClick(reservation.id);
        }}
        style={{
          position: 'absolute',
          left,
          top: 2,
          bottom: 2,
          width,
          backgroundColor: bgColor,
          borderRadius: 3,
          cursor: 'pointer',
          overflow: 'hidden',
          opacity: dimmed ? 0.2 : 0.85,
          border: endingSoon
            ? '1.5px solid #FF5722'
            : '1px solid rgba(0,0,0,0.08)',
          animation: endingSoon ? 'pulse-border 1.5s ease-in-out infinite' : undefined,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          padding: '0 3px',
        }}
      >
        {width > 20 && (
          <Text
            c="white"
            fw={600}
            truncate
            style={{
              fontSize: 9,
              lineHeight: 1,
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              whiteSpace: 'nowrap',
            }}
          >
            {reservation.guest_name.split(' ')[0]}
          </Text>
        )}
      </Box>
    );
  }

  // Desktop: full tooltip + hover effects
  const tooltipContent = (
    <div>
      <div><strong>{reservation.guest_name}</strong></div>
      <div>{reservation.start_time.substring(0, 5)} - {reservation.end_time.substring(0, 5)}</div>
      <div>{reservation.guest_count} gostiju</div>
      <div>Status: {STATUS_LABELS[reservation.status]}</div>
      {endingSoon && minsLeft !== null && <div>Oslobada se za {minsLeft} min</div>}
    </div>
  );

  return (
    <Tooltip label={tooltipContent} multiline w={200} position="top">
      <Box
        onClick={(e) => {
          e.stopPropagation();
          onClick(reservation.id);
        }}
        style={{
          position: 'absolute',
          left,
          top: 2,
          bottom: 2,
          width,
          backgroundColor: bgColor,
          borderRadius: 3,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 4px',
          overflow: 'hidden',
          border: isMatch
            ? '2px solid #fff'
            : endingSoon
              ? '2px solid #FF5722'
              : '1px solid rgba(0,0,0,0.08)',
          animation: endingSoon ? 'pulse-border 2s ease-in-out infinite' : undefined,
          opacity: dimmed ? 0.25 : 0.85,
          transition: 'transform 0.1s, box-shadow 0.1s, opacity 0.2s',
          zIndex: isMatch ? 4 : 2,
          boxShadow: isMatch ? '0 0 8px rgba(255,255,255,0.6)' : undefined,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = 'scaleY(1.1)';
          el.style.opacity = '1';
          el.style.boxShadow = isMatch
            ? '0 0 12px rgba(255,255,255,0.8)'
            : '0 2px 8px rgba(0,0,0,0.15)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.transform = 'scaleY(1)';
          el.style.opacity = dimmed ? '0.25' : '0.85';
          el.style.boxShadow = isMatch
            ? '0 0 8px rgba(255,255,255,0.6)'
            : 'none';
        }}
      >
        <Text
          size="xs"
          fw={600}
          c="white"
          truncate
          style={{ flex: 1, textShadow: '0 1px 2px rgba(0,0,0,0.3)', fontSize: 10, lineHeight: 1.2 }}
        >
          {reservation.guest_name} ({reservation.guest_count})
        </Text>
        {endingSoon && (
          <IconClock size={12} color="white" style={{ flexShrink: 0, marginLeft: 2 }} />
        )}
      </Box>
    </Tooltip>
  );
}
