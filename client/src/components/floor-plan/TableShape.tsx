import { Group, Rect, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import type { Table, ReservationStatus } from '../../api/types';
import { getTableColor } from './tableUtils';

interface TableShapeProps {
  table: Table;
  status: ReservationStatus | null;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: (tableId: number) => void;
  onDragEnd?: (tableId: number, pos: { x: number; y: number }) => void;
  onHoverEnter?: (table: Table) => void;
  onHoverLeave?: () => void;
}

export function TableShape({
  table,
  status,
  isSelected,
  isEditing,
  onSelect,
  onDragEnd,
  onHoverEnter,
  onHoverLeave,
}: TableShapeProps) {
  const fillColor = getTableColor(status);
  const strokeColor = isSelected ? '#000000' : '#666666';
  const strokeWidth = isSelected ? 3 : 1;
  const { width, height } = table;

  const handleClick = () => {
    onSelect(table.id);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    if (onDragEnd) {
      onDragEnd(table.id, {
        x: Math.round(e.target.x()),
        y: Math.round(e.target.y()),
      });
    }
  };

  const isCircle = table.shape === 'circle';
  const radius = Math.min(width, height) / 2;

  return (
    <Group
      x={table.pos_x}
      y={table.pos_y}
      rotation={table.rotation}
      draggable={isEditing}
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={handleDragEnd}
      onMouseEnter={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = isEditing ? 'grab' : 'pointer';
        onHoverEnter?.(table);
      }}
      onMouseLeave={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'default';
        onHoverLeave?.();
      }}
    >
      {isCircle ? (
        <Circle
          x={radius}
          y={radius}
          radius={radius}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          shadowColor="rgba(0,0,0,0.3)"
          shadowBlur={6}
          shadowOffsetX={2}
          shadowOffsetY={2}
          shadowEnabled
        />
      ) : (
        <Rect
          width={width}
          height={height}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          cornerRadius={8}
          shadowColor="rgba(0,0,0,0.3)"
          shadowBlur={6}
          shadowOffsetX={2}
          shadowOffsetY={2}
          shadowEnabled
        />
      )}

      {/* Table number label */}
      <Text
        text={table.table_number}
        x={0}
        y={isCircle ? radius - 14 : height / 2 - 14}
        width={isCircle ? radius * 2 : width}
        align="center"
        fontSize={16}
        fontStyle="bold"
        fill="#FFFFFF"
        listening={false}
      />

      {/* Capacity label */}
      <Text
        text={`${table.capacity} mesta`}
        x={0}
        y={isCircle ? radius + 2 : height / 2 + 2}
        width={isCircle ? radius * 2 : width}
        align="center"
        fontSize={11}
        fill="rgba(255,255,255,0.85)"
        listening={false}
      />
    </Group>
  );
}
