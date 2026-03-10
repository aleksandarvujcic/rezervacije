import { useState, useRef, useCallback, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import {
  Loader,
  Center,
  Text,
  Button,
  Group,
  Stack,
  Modal,
  TextInput,
  NumberInput,
  Select,
  ActionIcon,
  Paper,
  Tooltip,
} from '@mantine/core';
import { useDisclosure, useElementSize } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconDeviceFloppy, IconZoomIn, IconZoomOut } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTablesByZone, useFloorPlan, useUpdateLayout } from '../../hooks/useFloorPlan';
import { tablesApi } from '../../api/endpoints';
import { TableShape } from './TableShape';
import { getTableDimensions } from './tableUtils';
import type { Table } from '../../api/types';

interface FloorPlanEditorProps {
  zoneId: number;
}

interface LocalTableState {
  [tableId: number]: { pos_x: number; pos_y: number };
}

interface NewTableForm {
  table_number: string;
  capacity: number;
  shape: 'rectangle' | 'circle' | 'square';
}

export function FloorPlanEditor({ zoneId }: FloorPlanEditorProps) {
  const queryClient = useQueryClient();
  const { data: tables, isLoading: tablesLoading } = useTablesByZone(zoneId);
  useFloorPlan(zoneId); // prefetch floor plan data
  const updateLayoutMutation = useUpdateLayout();

  const { ref: containerRef, width: containerWidth, height: containerHeight } =
    useElementSize();
  const stageRef = useRef<Konva.Stage>(null);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [localPositions, setLocalPositions] = useState<LocalTableState>({});
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Modal for adding a new table
  const [addModalOpened, { open: openAddModal, close: closeAddModal }] =
    useDisclosure(false);
  const [newTable, setNewTable] = useState<NewTableForm>({
    table_number: '',
    capacity: 4,
    shape: 'rectangle',
  });

  const createTableMutation = useMutation({
    mutationFn: (data: Partial<Table>) => tablesApi.create(zoneId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables', zoneId] });
      closeAddModal();
      setNewTable({ table_number: '', capacity: 4, shape: 'rectangle' });
      notifications.show({
        title: 'Sto dodat',
        message: 'Novi sto je uspešno dodat.',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Greška',
        message: 'Nije moguće dodati sto.',
        color: 'red',
      });
    },
  });

  // Reset local positions when tables data changes
  useEffect(() => {
    setLocalPositions({});
    setHasChanges(false);
  }, [tables]);

  // Reset when zone changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setSelectedTableId(null);
  }, [zoneId]);

  // Handle drag end
  const handleDragEnd = useCallback(
    (tableId: number, pos: { x: number; y: number }) => {
      setLocalPositions((prev) => ({
        ...prev,
        [tableId]: { pos_x: pos.x, pos_y: pos.y },
      }));
      setHasChanges(true);
    },
    []
  );

  // Handle save
  const handleSave = useCallback(() => {
    if (!tables) return;

    const updatedTables = tables.map((table) => {
      const localPos = localPositions[table.id];
      if (localPos) {
        return {
          id: table.id,
          pos_x: localPos.pos_x,
          pos_y: localPos.pos_y,
        };
      }
      return {
        id: table.id,
        pos_x: table.pos_x,
        pos_y: table.pos_y,
      };
    });

    updateLayoutMutation.mutate(
      { zoneId, tables: updatedTables },
      {
        onSuccess: () => {
          setHasChanges(false);
          setLocalPositions({});
          notifications.show({
            title: 'Sačuvano',
            message: 'Raspored stolova je sačuvan.',
            color: 'green',
          });
        },
        onError: () => {
          notifications.show({
            title: 'Greška',
            message: 'Nije moguće sačuvati raspored.',
            color: 'red',
          });
        },
      }
    );
  }, [tables, localPositions, zoneId, updateLayoutMutation]);

  // Handle add table submit
  const handleAddTable = useCallback(() => {
    const dims = getTableDimensions(newTable.capacity);
    createTableMutation.mutate({
      table_number: newTable.table_number,
      capacity: newTable.capacity,
      shape: newTable.shape,
      pos_x: 100,
      pos_y: 100,
      width: dims.width,
      height: dims.height,
      rotation: 0,
      is_active: true,
    });
  }, [newTable, createTableMutation]);

  // Zoom handlers
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const scaleBy = 1.08;
      const newScale =
        e.evt.deltaY < 0
          ? Math.min(oldScale * scaleBy, 2.0)
          : Math.max(oldScale / scaleBy, 0.5);

      const mousePointTo = {
        x: (pointer.x - position.x) / oldScale,
        y: (pointer.y - position.y) / oldScale,
      };

      setScale(newScale);
      setPosition({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
    },
    [scale, position]
  );

  // Pan
  const isPanning = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.evt.button === 1 || (e.evt.button === 0 && e.evt.ctrlKey)) {
        e.evt.preventDefault();
        isPanning.current = true;
        lastPointer.current = { x: e.evt.clientX, y: e.evt.clientY };
      }
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanning.current) {
        const dx = e.evt.clientX - lastPointer.current.x;
        const dy = e.evt.clientY - lastPointer.current.y;
        lastPointer.current = { x: e.evt.clientX, y: e.evt.clientY };
        setPosition((prev) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
      }
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev * 1.2, 2.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev / 1.2, 0.5));
  }, []);

  if (tablesLoading) {
    return (
      <Center h="100%">
        <Stack align="center" gap="sm">
          <Loader size="lg" />
          <Text c="dimmed">Učitavanje...</Text>
        </Stack>
      </Center>
    );
  }

  // Build display tables with local position overrides
  const displayTables: Table[] = (tables ?? []).map((table) => {
    const localPos = localPositions[table.id];
    if (localPos) {
      return { ...table, pos_x: localPos.pos_x, pos_y: localPos.pos_y };
    }
    return table;
  });

  const stageWidth = containerWidth || 800;
  const stageHeight = containerHeight || 600;

  return (
    <Stack h="100%" gap={0}>
      {/* Toolbar */}
      <Paper p="sm" withBorder style={{ flexShrink: 0 }}>
        <Group justify="space-between">
          <Group gap="sm">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              disabled={!hasChanges}
              loading={updateLayoutMutation.isPending}
            >
              Sačuvaj raspored
            </Button>
            <Button
              variant="outline"
              leftSection={<IconPlus size={16} />}
              onClick={openAddModal}
            >
              Dodaj sto
            </Button>
          </Group>
          <Group gap="xs">
            <Tooltip label="Umanji">
              <ActionIcon variant="light" onClick={handleZoomOut}>
                <IconZoomOut size={18} />
              </ActionIcon>
            </Tooltip>
            <Text size="sm" c="dimmed" w={50} ta="center">
              {Math.round(scale * 100)}%
            </Text>
            <Tooltip label="Uvećaj">
              <ActionIcon variant="light" onClick={handleZoomIn}>
                <IconZoomIn size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Paper>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          minHeight: 400,
        }}
      >
        {displayTables.length === 0 ? (
          <Center h="100%">
            <Stack align="center" gap="sm">
              <Text c="dimmed" size="lg">
                Nema stolova. Kliknite "Dodaj sto" da počnete.
              </Text>
            </Stack>
          </Center>
        ) : (
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={stageHeight}
            scaleX={scale}
            scaleY={scale}
            x={position.x}
            y={position.y}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <Layer>
              {displayTables.map((table) => (
                <TableShape
                  key={table.id}
                  table={table}
                  status={null}
                  isSelected={selectedTableId === table.id}
                  isEditing={true}
                  onSelect={(id) => setSelectedTableId(id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </Layer>
          </Stage>
        )}
      </div>

      {/* Add Table Modal */}
      <Modal
        opened={addModalOpened}
        onClose={closeAddModal}
        title="Dodaj novi sto"
      >
        <Stack gap="md">
          <TextInput
            label="Broj stola"
            placeholder="npr. 1, A1, VIP1"
            value={newTable.table_number}
            onChange={(e) =>
              setNewTable((prev) => ({
                ...prev,
                table_number: e.currentTarget.value,
              }))
            }
            required
          />
          <NumberInput
            label="Kapacitet (broj mesta)"
            value={newTable.capacity}
            onChange={(value) =>
              setNewTable((prev) => ({
                ...prev,
                capacity: typeof value === 'number' ? value : 4,
              }))
            }
            min={1}
            max={20}
            required
          />
          <Select
            label="Oblik"
            value={newTable.shape}
            onChange={(value) =>
              setNewTable((prev) => ({
                ...prev,
                shape: (value as 'rectangle' | 'circle' | 'square') ?? 'rectangle',
              }))
            }
            data={[
              { value: 'rectangle', label: 'Pravougaonik' },
              { value: 'circle', label: 'Krug' },
              { value: 'square', label: 'Kvadrat' },
            ]}
          />
          <Button
            fullWidth
            onClick={handleAddTable}
            loading={createTableMutation.isPending}
            disabled={!newTable.table_number.trim()}
          >
            Dodaj
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
