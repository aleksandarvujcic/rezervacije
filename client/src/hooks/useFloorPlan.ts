import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zonesApi, tablesApi, floorPlansApi } from '../api/endpoints';
import type { Table } from '../api/types';

export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: () => zonesApi.list(),
  });
}

export function useTablesByZone(zoneId: number | null) {
  return useQuery({
    queryKey: ['tables', zoneId],
    queryFn: () => tablesApi.listByZone(zoneId!),
    enabled: !!zoneId,
  });
}

export function useFloorPlan(zoneId: number | null) {
  return useQuery({
    queryKey: ['floor-plan', zoneId],
    queryFn: () => floorPlansApi.getByZone(zoneId!),
    enabled: !!zoneId,
  });
}

export function useUpdateLayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      zoneId,
      tables,
    }: {
      zoneId: number;
      tables: Partial<Table>[];
    }) => tablesApi.updateLayout(zoneId, tables),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['tables', variables.zoneId],
      });
    },
  });
}
